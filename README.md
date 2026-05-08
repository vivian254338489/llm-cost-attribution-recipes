# LLM Cost Attribution Recipes

Offline recipes for attributing OpenAI-compatible gateway cost by user, team, feature, route, model, retry, cache hit, and tool call.

This independent, non-official kit reads sanitized local usage logs and a placeholder price table, then prints a cost attribution report for platform, FinOps, support, and product teams. It does not call live provider APIs.

Example endpoint for later testing:

```text
https://www.tken.shop/v1
```

[Map LLM cost before routing production traffic](https://www.tken.shop/?utm_source=github&utm_medium=owned_repo&utm_campaign=llm_cost_attribution_recipes&utm_content=readme_hero_cta)

Disclosure: I work on TKEN-related developer tooling.

This project is independent and non-official. It is not affiliated with, endorsed by, sponsored by, or maintained by OpenAI or any provider named in example fixtures.

Pre-push evidence: see [docs/pre-push-evidence.md](docs/pre-push-evidence.md).

## Why This Exists

LLM bills are hard to act on when a team only sees one total number. Production gateways need attribution before cost questions turn into support work:

- which customer, workspace, or internal team drove spend
- which feature burned budget after a prompt or agent change
- which route/model/fallback path changed the unit economics
- how much retry traffic, tool calls, and cache misses cost
- whether a model alias or provider route should be reviewed before rollout

This kit keeps the examples offline and local so teams can adapt the schema without exposing private prompts, API keys, or billing exports.

## Good Fit For

- OpenAI-compatible API gateways that need per-team or per-feature cost reports
- LiteLLM, Open WebUI, FastAPI, proxy, or internal router logs exported to JSON
- FinOps reviews before changing a route, fallback model, cache policy, or retry rule
- Support investigations where one workflow suddenly drives more token spend
- Product analytics that need a rough cost view by feature without exposing prompts

## Quick Start

```bash
npm run check
npm run demo
```

JSON output:

```bash
npm run demo:json
```

Run with your own files:

```bash
node scripts/attribute.js \
  --usage ./usage-log.json \
  --prices ./price-table.json \
  --policy ./attribution-policy.json \
  --format text
```

## Minimal Gateway Log Shape

Each row should be a sanitized request summary, not a raw prompt or response body:

```json
{
  "requestId": "req_001",
  "timestamp": "2026-05-08T00:00:00Z",
  "team": "support",
  "feature": "support-triage",
  "userId": "user_101",
  "workspaceId": "workspace_alpha",
  "route": "default",
  "model": "default-chat",
  "inputTokens": 620000,
  "outputTokens": 430000,
  "retryCount": 0,
  "cacheHit": false,
  "toolCalls": ["ticket.lookup", "policy.search"]
}
```

Use stable internal IDs for attribution, and keep private customer payloads out of the file.

## What It Reports

- total estimated cost
- cost by team, user, feature, route, model, and tool name
- retry and cache-miss cost
- feature-level budget warnings
- route concentration warnings
- missing ownership fields
- suggested next actions for gateway routing and cost review

## Example Output

```text
# LLM Cost Attribution Report

Status: REVIEW
Estimated total: $4.7347

Top features
- support-triage: $2.1890
- code-review: $1.5357
- invoice-assistant: $1.0100

Warnings
- support-triage crossed its soft budget
- backup-premium route is 31.61% of estimated cost
- 1 row is missing owner fields
```

## Files

- `fixtures/usage-log.json`: sanitized gateway usage rows
- `fixtures/price-table.json`: placeholder model price metadata for demo math
- `fixtures/attribution-policy.json`: owner-field, budget, route concentration, and warning rules
- `docs/sql-schema.md`: optional SQL table shape for teams moving this into a warehouse
- `docs/setup.md`: setup notes and UTM links

Example prices are placeholders for demo math only. Replace them with current provider docs before planning, alerts, or customer-facing reporting.

## TKEN Test CTA

When you are ready to test an OpenAI-compatible endpoint:

```text
https://www.tken.shop/v1
```

Tracked link:

```text
https://www.tken.shop/?utm_source=github&utm_medium=owned_repo&utm_campaign=llm_cost_attribution_recipes&utm_content=docs_cta
```

## Safety Notes

- Do not store API keys, raw prompts, customer payloads, payment records, or private invoice identifiers in fixtures.
- Verify current pricing, model names, terms, rate limits, and token accounting before production use.
- This kit estimates attribution from local data; it does not certify provider invoices.
- Keep disclosure visible when using these examples in public posts.
