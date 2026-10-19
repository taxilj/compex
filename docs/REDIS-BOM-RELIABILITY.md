# Redis and BOM reliability (F2 / F16)

Status: **code behaves correctly under quota failure (measured); the quota itself is a provider/billing matter and was not touched.** No Redis plan, billing or production setting was changed.

## What production showed

Redis is an external provider (Render has no Key Value instance). On 2026-10-19 `GET /api/v1/leads/bom-capability` returned `available:false` at 05:00 UTC, Render logged `[bom-worker] Redis quota-exceeded; queue processing is delayed` every 5 minutes until about 11:30 UTC, and by 12:03 UTC the endpoint answered `true`. BOM upload therefore switches off and on during the day.

## What the code does when Redis is out of quota (tested)

`compex-api/test/integration/redis-bom-reliability.test.ts` runs real BullMQ against a disposable loopback Redis (`REDIS_IT_URL`, skipped when unset or not loopback) and a TCP stand-in that answers every command with the provider's quota error. Measured on 2026-10-19:

| Scenario | Result |
|---|---|
| Worker, quota-exhausted Redis, circuit breaker on (production) | 11 commands in 10 s |
| Same worker **without** the breaker (control, not committed) | 153,258 commands in 10 s: a busy loop that would burn a month's quota in minutes |
| Idle worker, production options (`WORKER_IDLE_OPTIONS`), 12 s | about 0 commands |
| Idle worker, BullMQ defaults (control) | 15 commands in 12 s |
| Enqueue while quota-exhausted | fails within the 5 s bound with HTTP 503; upload kept as `UPLOADED` (pending); capability flips to `false`; repeated probes inside the cool-down send no further Redis command |
| Redis returns | the paused worker resumes by itself after its cool-down and handles the pending job exactly once, with no restart |
| Same `jobId` added twice, two workers | one job queued, one delivery; after completion the id is free again so recovery can re-add |
| Worker dies mid-job | the stalled job is redelivered to another worker once |

Already covered by unit tests (no change needed): documents stranded in `PROCESSING` for 30 minutes are handed back by `jobs/bom-recovery.ts`, superseded or closed-RFQ documents are retired instead of re-processed, and the worker's conditional claim means a document is never appended twice.

## Capability honesty

`bom-capability` is the AND of a durable-storage check (cached 60 s) and a real Redis round trip (not `PING`, which a quota-exhausted provider still answers), cached 5 minutes when healthy and 60 s when not. Worst case: up to 5 minutes after the quota runs out the flag can still read `true`; the first upload then gets a 503 with the "saved, will be processed automatically" message and the flag flips to `false` immediately. No document is lost in that window.

## Where the quota is probably going (not proven)

Queue workers are not the cause (table above). The remaining Redis traffic is the public catalogue cache: one `GET` per catalogue request, a `SET` per miss and a version read every 5 s per process (`catalog-cache.ts`). That scales with visitors and crawlers. This could not be confirmed: the provider's per-command dashboard is the only source and was not accessible.

## Recommendations (all need your decision)

1. Look at the provider dashboard's command graph around the quota resets to confirm the catalogue cache is the main consumer.
2. If it is, either add a small per-process in-memory layer in front of the Redis cache (code change, would cut commands by the hit rate) or move to a plan whose quota matches traffic. This is a billing decision and was not made here.
3. Until then, BOM upload remains correct but intermittently unavailable, and staff should check pending BOMs after an outage (they are processed automatically once Redis is back, within 24 hours).
