#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const usagePath = args.usage ?? "fixtures/usage-log.json";
const pricesPath = args.prices ?? "fixtures/price-table.json";
const policyPath = args.policy ?? "fixtures/attribution-policy.json";
const format = args.format ?? "text";

const usage = readJson(usagePath);
const prices = readJson(pricesPath);
const policy = readJson(policyPath);
const report = buildReport({ usage, prices, policy });

if (format === "json") {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderText(report));
}

process.exitCode = report.blocking.length > 0 ? 1 : 0;

function parseArgs(raw) {
  const parsed = {};
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = raw[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function readJson(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    console.error(`Failed to read JSON: ${resolved}`);
    console.error(error.message);
    process.exit(1);
  }
}

function buildReport({ usage, prices, policy }) {
  const priceMap = new Map(
    (prices.models ?? []).map((model) => [
      model.model,
      {
        input: Number(model.input_per_1m_tokens_usd),
        output: Number(model.output_per_1m_tokens_usd)
      }
    ])
  );

  const rows = [];
  const blocking = [];
  const warnings = [];
  const missingOwnerRows = [];
  const byTeam = new Map();
  const byUser = new Map();
  const byWorkspace = new Map();
  const byFeature = new Map();
  const byRoute = new Map();
  const byModel = new Map();
  const byTool = new Map();
  let total = 0;
  let retryCost = 0;
  let cacheMissCost = 0;

  for (const row of usage.rows ?? []) {
    const price = priceMap.get(row.model);
    if (!price) {
      blocking.push(`missing price row for model: ${row.model}`);
      continue;
    }

    const inputCost = (Number(row.inputTokens) / 1_000_000) * price.input;
    const outputCost = (Number(row.outputTokens) / 1_000_000) * price.output;
    const estimatedCost = roundMoney(inputCost + outputCost);
    const retryShare = Number(row.retryCount) > 0 ? estimatedCost * Math.min(Number(row.retryCount), 3) * 0.18 : 0;

    const attributed = {
      requestId: row.requestId,
      team: valueOrUnknown(row.team),
      feature: valueOrUnknown(row.feature),
      userId: valueOrUnknown(row.userId),
      workspaceId: valueOrUnknown(row.workspaceId),
      route: valueOrUnknown(row.route),
      model: row.model,
      inputTokens: Number(row.inputTokens),
      outputTokens: Number(row.outputTokens),
      estimatedCost,
      retryCost: roundMoney(retryShare),
      cacheMiss: row.cacheHit === false,
      toolCalls: Array.isArray(row.toolCalls) ? row.toolCalls : []
    };

    rows.push(attributed);
    total += estimatedCost;
    retryCost += attributed.retryCost;
    if (attributed.cacheMiss) cacheMissCost += estimatedCost;

    add(byTeam, attributed.team, estimatedCost);
    add(byUser, attributed.userId, estimatedCost);
    add(byWorkspace, attributed.workspaceId, estimatedCost);
    add(byFeature, attributed.feature, estimatedCost);
    add(byRoute, attributed.route, estimatedCost);
    add(byModel, attributed.model, estimatedCost);
    for (const tool of attributed.toolCalls) add(byTool, tool, estimatedCost);

    const missingFields = [];
    for (const field of policy.requiredOwnerFields ?? []) {
      if (!row[field]) missingFields.push(field);
    }
    if (missingFields.length) {
      missingOwnerRows.push({ requestId: row.requestId, missingFields });
    }
  }

  total = roundMoney(total);
  retryCost = roundMoney(retryCost);
  cacheMissCost = roundMoney(cacheMissCost);

  for (const [feature, budget] of Object.entries(policy.featureSoftBudgetsUsd ?? {})) {
    const observed = roundMoney(byFeature.get(feature) ?? 0);
    if (observed > Number(budget)) {
      warnings.push(`${feature} crossed soft budget: ${money(observed)} > ${money(Number(budget))}`);
    }
  }

  const routeConcentrationWarnPercent = Number(policy.routeConcentrationWarnPercent ?? 0);
  if (total > 0 && routeConcentrationWarnPercent > 0) {
    for (const [route, cost] of byRoute.entries()) {
      const percent = (cost / total) * 100;
      if (percent >= routeConcentrationWarnPercent) {
        warnings.push(`${route} route is ${percent.toFixed(2)}% of estimated cost`);
      }
    }
  }

  const retryPercent = total > 0 ? (retryCost / total) * 100 : 0;
  if (retryPercent >= Number(policy.retryCostWarnPercent ?? Infinity)) {
    warnings.push(`retry-attributed cost is ${retryPercent.toFixed(2)}% of estimated cost`);
  }

  const cacheMissPercent = total > 0 ? (cacheMissCost / total) * 100 : 0;
  if (cacheMissPercent >= Number(policy.cacheMissCostWarnPercent ?? Infinity)) {
    warnings.push(`cache-miss cost is ${cacheMissPercent.toFixed(2)}% of estimated cost`);
  }

  if (missingOwnerRows.length) {
    warnings.push(`${missingOwnerRows.length} row is missing owner fields`);
  }

  return {
    ok: blocking.length === 0,
    status: blocking.length ? "FAIL" : warnings.length ? "REVIEW" : "PASS",
    totalEstimatedCostUsd: total,
    retryCostUsd: retryCost,
    cacheMissCostUsd: cacheMissCost,
    blocking,
    warnings,
    missingOwnerRows,
    totals: {
      byTeam: topEntries(byTeam),
      byUser: topEntries(byUser),
      byWorkspace: topEntries(byWorkspace),
      byFeature: topEntries(byFeature),
      byRoute: topEntries(byRoute),
      byModel: topEntries(byModel),
      byTool: topEntries(byTool)
    },
    rows,
    trackedCta: policy.trackedCta ?? null,
    suggestedNextActions: [
      "Add team, feature, user, and workspace IDs to every gateway log row.",
      "Review high-cost route and model aliases before the next rollout.",
      "Track retry and cache-miss cost separately from primary request cost.",
      "Verify current model pricing and token accounting before customer-facing reports.",
      "Use a real endpoint smoke test before routing production traffic."
    ]
  };
}

function add(map, key, value) {
  map.set(key, roundMoney((map.get(key) ?? 0) + value));
}

function topEntries(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, cost]) => ({ key, estimatedCostUsd: roundMoney(cost) }));
}

function valueOrUnknown(value) {
  return value || "unknown";
}

function roundMoney(value) {
  return Math.round(Number(value) * 10000) / 10000;
}

function money(value) {
  return `$${roundMoney(value).toFixed(4)}`;
}

function renderText(report) {
  const lines = [];
  lines.push("# LLM Cost Attribution Report");
  lines.push("");
  lines.push(`Status: ${report.status}`);
  lines.push(`Estimated total: ${money(report.totalEstimatedCostUsd)}`);
  lines.push(`Retry-attributed cost: ${money(report.retryCostUsd)}`);
  lines.push(`Cache-miss cost: ${money(report.cacheMissCostUsd)}`);
  lines.push("");

  lines.push("Top features");
  for (const item of report.totals.byFeature.slice(0, 6)) lines.push(`- ${item.key}: ${money(item.estimatedCostUsd)}`);
  lines.push("");

  lines.push("Top routes");
  for (const item of report.totals.byRoute.slice(0, 6)) lines.push(`- ${item.key}: ${money(item.estimatedCostUsd)}`);
  lines.push("");

  lines.push("Top teams");
  for (const item of report.totals.byTeam.slice(0, 6)) lines.push(`- ${item.key}: ${money(item.estimatedCostUsd)}`);
  lines.push("");

  lines.push("Warnings");
  if (report.warnings.length) {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push("- none");
  }
  lines.push("");

  lines.push("Blocking checks");
  if (report.blocking.length) {
    for (const item of report.blocking) lines.push(`- ${item}`);
  } else {
    lines.push("- none");
  }
  lines.push("");

  lines.push("Suggested next actions");
  for (const action of report.suggestedNextActions) lines.push(`- ${action}`);

  if (report.trackedCta) {
    lines.push("");
    lines.push("Tracked endpoint test CTA");
    lines.push(report.trackedCta);
  }

  return lines.join("\n");
}
