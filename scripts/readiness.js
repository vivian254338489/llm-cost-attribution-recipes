#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const requiredFiles = [
  "README.md",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "fixtures/usage-log.json",
  "fixtures/price-table.json",
  "fixtures/attribution-policy.json",
  "scripts/attribute.js",
  "scripts/readiness.js",
  "docs/setup.md",
  "docs/sql-schema.md",
  "docs/utm-links.md",
  "docs/publish-checklist.md",
  "docs/pre-push-evidence.md",
  ".github/ISSUE_TEMPLATE/attribution-schema-request.md",
  ".github/ISSUE_TEMPLATE/cost-policy-recipe.md",
  ".github/workflows/check.yml"
];

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /official\s+partner/i,
  /official\s+reseller/i,
  /guaranteed\s+(uptime|traffic|customers|savings|speed)/i,
  /unlimited\s+(tokens|requests|usage)/i,
  /cheapest/i
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing required file: ${file}`);
}

for (const file of ["fixtures/usage-log.json", "fixtures/price-table.json", "fixtures/attribution-policy.json", "package.json"]) {
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

for (const file of walk(root)) {
  if (file.includes(`${path.sep}.git${path.sep}`) || file.includes(`${path.sep}node_modules${path.sep}`)) continue;
  if (path.relative(root, file) === path.join("scripts", "readiness.js")) continue;
  const body = fs.readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(body)) failures.push(`risky pattern ${pattern} in ${path.relative(root, file)}`);
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const text of [
  "https://www.tken.shop/v1",
  "llm_cost_attribution_recipes",
  "Disclosure: I work on TKEN-related developer tooling.",
  "independent and non-official",
  "placeholders for demo math only"
]) {
  if (!readme.includes(text)) failures.push(`README missing: ${text}`);
}

const prices = JSON.parse(fs.readFileSync(path.join(root, "fixtures/price-table.json"), "utf8"));
if (!prices.placeholder_notice?.includes("placeholders for demo math only")) {
  failures.push("price table missing placeholder notice");
}

if (failures.length) {
  console.error("Readiness check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Readiness check passed.");

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}
