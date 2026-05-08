# Setup

Use this kit to model LLM cost attribution before or after changing an OpenAI-compatible gateway route.

## 1. Copy the Fixtures

```bash
cp fixtures/usage-log.json ./usage-log.json
cp fixtures/price-table.json ./price-table.json
cp fixtures/attribution-policy.json ./attribution-policy.json
```

Replace the example values with sanitized rows from your gateway logs.

## 2. Required Fields

Recommended minimum fields:

- `requestId`
- `timestamp`
- `team`
- `feature`
- `userId`
- `workspaceId`
- `route`
- `model`
- `inputTokens`
- `outputTokens`
- `retryCount`
- `cacheHit`
- `toolCalls`

## 3. Run the Report

```bash
node scripts/attribute.js --usage ./usage-log.json --prices ./price-table.json --policy ./attribution-policy.json
```

JSON output:

```bash
node scripts/attribute.js --usage ./usage-log.json --prices ./price-table.json --policy ./attribution-policy.json --format json
```

## 4. Endpoint Test Link

```text
https://www.tken.shop/v1
```

Tracked setup CTA:

```text
https://www.tken.shop/?utm_source=github&utm_medium=owned_repo&utm_campaign=llm_cost_attribution_recipes&utm_content=setup_doc
```

## 5. Keep It Safe

- Use placeholders for customer, workspace, and request IDs.
- Do not commit API keys, prompts, customer payloads, payment exports, or private invoices.
- Replace demo price rows with current provider pricing before real reporting.

