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

`bom-capability` is the AND of a durable-storage check (cached 60 s) and the Redis verdict from `src/lib/redis-health.ts`.

**Why the old check was wrong (observed 2026-10-20):** it probed with a read (`HEXISTS`) and cached "healthy" for five minutes. At 497,581 of 500,000 monthly commands the provider was rejecting writes (`[cache] set failed … quota-exceeded`) and queue commands (`[bom-worker] Redis quota-exceeded` every five minutes) while `bom-capability` kept answering `true`, because reads still passed.

**How it works now:** the cache, the queue producer and the BOM worker report what they see to a small in-process memory.
- Any Redis failure is remembered: **10 minutes** for quota exhaustion, **1 minute** for timeouts and connection errors. While it is remembered the capability is `false` and Redis is sent nothing.
- Only an accepted **write** (a cache `SET`, a counter, a BOM enqueue, or the probe) counts as healthy. Reads never do. Healthy evidence lasts five minutes.
- With no recent evidence either way, **one write probe** (`SET compex:health:probe 1 EX 120`) is sent. During a failing or busy period that is at most a handful of commands an hour; under normal traffic the cache writes keep it at zero.
- While Redis is known to be failing, `enqueueBomJob` does not send Redis another command: the upload stays stored and `UPLOADED` (HTTP 503 with the "saved, will be processed automatically" message) and `jobs/bom-recovery.ts` enqueues it once Redis accepts writes again. Nothing is deleted or marked failed.
- Recovery is automatic: the hold expires, or any accepted write clears it, and the next check or sweep proceeds.

Tests: `test/unit/redis-health.test.ts`, `bom-queue-health.test.ts`, `redis-cache-health.test.ts`, `bom-capability-route.test.ts`, and the real-Redis scenarios in `test/integration/redis-bom-reliability.test.ts`.

## Where the quota went (provider dashboard, 2026-10-20)

Upstash shows one database on the **Free Tier** with no payment method: 497,581 of 500,000 monthly commands, cost $0.00. Over the last five days only a few dozen commands per day were processed and the week view shows only small per-interval counts, so the quota was used up **before about 13 October**, which fits idle BullMQ polling before the 12 October release set `drainDelay`/`stalledInterval`. Today's traffic is roughly ten commands an hour (cache `GET`, the capability probe, connection setup). The reset date is not shown on the free tier. At the current rate the remaining ~2,400 commands would not run out before the monthly counter resets, but the provider still rejected writes today, which the dashboard numbers do not explain.

## Recommendations (all need your decision)

1. Look at the provider dashboard's command graph around the quota resets to confirm the catalogue cache is the main consumer.
2. If it is, either add a small per-process in-memory layer in front of the Redis cache (code change, would cut commands by the hit rate) or move to a plan whose quota matches traffic. This is a billing decision and was not made here.
3. Until then, BOM upload remains correct but intermittently unavailable, and staff should check pending BOMs after an outage (they are processed automatically once Redis is back, within 24 hours).
