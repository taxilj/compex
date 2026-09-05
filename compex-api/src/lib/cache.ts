import IORedis from "ioredis";
import { env } from "../config/env.js";

// Small shared cache helper backed by the same Redis instance already used
// for BullMQ (env.REDIS_URL) -- see follow-up-scheduler.ts for the existing
// producer-connection pattern this mirrors. Introduced for Phase 16 of the
// Nexar integration (repeated exact-MPN lookups should not re-hit the
// upstream API), but written generically so any future provider fetcher can
// reuse it instead of inventing per-source caching.
//
// Deliberately NOT process-memory-only: this process (compex-api on Render)
// can run multiple instances/replicas, and a bare in-memory Map would give
// every instance its own cold cache and would not survive a restart/deploy.
// Redis is already part of this stack's production infrastructure, so this
// adds no new infra.
//
// Failure handling: caching is a pure optimization. A Redis outage must
// never fail (or "poison") a request that would otherwise succeed --
// get()/set() both swallow Redis errors and log, falling through to
// "cache miss" behaviour so the caller always still hits the upstream API.

let client: IORedis | null = null;
let loggedConnectionError = false;

function getClient(): IORedis | null {
  if (client) return client;
  try {
    client = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
      lazyConnect: false,
    });
    client.on("error", (err) => {
      // ioredis requires an 'error' listener or it throws; keep this a
      // single best-effort log line rather than crashing the process on a
      // transient Redis blip.
      if (!loggedConnectionError) {
        loggedConnectionError = true;
        console.error("[cache] Redis connection error (caching disabled until it recovers):", err.message);
      }
    });
    return client;
  } catch {
    return null;
  }
}

export interface CacheEntry<T> {
  value: T;
  cachedAt: string;
}

// namespace keeps unrelated callers (Nexar MPN lookups, anything added
// later) from ever colliding on the same Redis key.
export async function cacheGet<T>(namespace: string, key: string): Promise<CacheEntry<T> | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(`compex:cache:${namespace}:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch (err) {
    console.error(`[cache] get failed for ${namespace}:${key}, treating as a miss:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function cacheSet<T>(namespace: string, key: string, value: T, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  const redis = getClient();
  if (!redis) return;
  try {
    const entry: CacheEntry<T> = { value, cachedAt: new Date().toISOString() };
    await redis.set(`compex:cache:${namespace}:${key}`, JSON.stringify(entry), "EX", ttlSeconds);
  } catch (err) {
    // A failed write just means the next lookup misses the cache -- never
    // let a caching problem surface as (or block) an application error.
    console.error(`[cache] set failed for ${namespace}:${key}, continuing without caching this entry:`, err instanceof Error ? err.message : err);
  }
}

// A provider-specific failure (bad MPN response, upstream 5xx, etc.) must
// never poison the cache for that key -- callers should simply not call
// cacheSet() on failure, which is the default in nexar-fetcher.ts. This
// helper exists so that intent is explicit and greppable at call sites.
export async function cacheDelete(namespace: string, key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.del(`compex:cache:${namespace}:${key}`);
  } catch {
    // best-effort
  }
}
