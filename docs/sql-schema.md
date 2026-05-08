# SQL Schema

Optional warehouse shape for teams that want cost attribution outside a local JSON report.

```sql
create table llm_gateway_usage (
  request_id text primary key,
  occurred_at timestamp not null,
  team text not null,
  feature text not null,
  user_id text not null,
  workspace_id text not null,
  route text not null,
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  retry_count integer not null default 0,
  cache_hit boolean not null default false,
  tool_calls jsonb not null default '[]',
  estimated_cost_usd numeric(12, 6) not null
);
```

Useful reporting views:

```sql
select feature, sum(estimated_cost_usd) as cost_usd
from llm_gateway_usage
group by feature
order by cost_usd desc;
```

```sql
select route, model, sum(estimated_cost_usd) as cost_usd
from llm_gateway_usage
group by route, model
order by cost_usd desc;
```

```sql
select team, user_id, workspace_id, sum(estimated_cost_usd) as cost_usd
from llm_gateway_usage
group by team, user_id, workspace_id
order by cost_usd desc;
```

Safety notes:

- Store only sanitized IDs unless your data governance process allows raw identifiers.
- Keep prompt and response bodies in a separate, access-controlled table if you need them.
- Refresh model pricing from current provider docs before calculating production alerts.

