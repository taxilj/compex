import { cacheGet, cacheSet } from "../../lib/cache.js";
import { withTimeout } from "../../lib/async.js";

// Public catalogue read-through cache (categories, product lists, manufacturers).
// Redis is an optimisation only: every Redis call is bounded so a slow or dead
// Redis degrades to a direct database read instead of hanging the page.
//
// Invalidation: keys embed a version stamp; bumpCatalogVersion() (called after
// any catalogue write, see app.ts) makes every older key unreachable at once.
// The short TTL bounds staleness for writes made outside this process.

const NAMESPACE = "catalog";
const REDIS_BUDGET_MS = 300;
const LOAD_BUDGET_MS = 15_000;
const VERSION_KEY = "version";
const VERSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const CATALOG_TTL_SECONDS = 60;
export const PUBLIC_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";

const inflight = new Map<string, Promise<unknown>>();

// null = version unknown (Redis failed): callers bypass the cache rather than
// risk serving entries from before an invalidation.
async function currentVersion(): Promise<string | null> {
  if (Date.now() < skipRedisUntil) return null;
  try {
    const entry = await withTimeout(cacheGet<number>(NAMESPACE, VERSION_KEY), REDIS_BUDGET_MS, "catalog version");
    return String(entry?.value ?? 0);
  } catch (err) {
    tripBreaker(err);
    return null;
  }
}

// A Redis that is unreachable or slower than the budget would otherwise add the
// full budget to EVERY request (worse than no cache). After one failure, skip
// Redis for a cool-down and serve straight from the database.
const BREAKER_COOLDOWN_MS = 30_000;
let skipRedisUntil = 0;

function tripBreaker(err: unknown): void {
  if (Date.now() >= skipRedisUntil) {
    console.warn(`[catalog-cache] Redis slow or unavailable (${err instanceof Error ? err.message : err}); serving from the database for ${BREAKER_COOLDOWN_MS / 1000}s`);
  }
  skipRedisUntil = Date.now() + BREAKER_COOLDOWN_MS;
}

export function resetCatalogBreaker(): void {
  skipRedisUntil = 0;
}

export async function bumpCatalogVersion(): Promise<void> {
  try {
    await withTimeout(cacheSet(NAMESPACE, VERSION_KEY, Date.now(), VERSION_TTL_SECONDS), REDIS_BUDGET_MS, "catalog version bump");
  } catch {
    // Redis unavailable: the TTL still bounds staleness.
  }
}

export async function cachedCatalog<T>(key: string, load: () => Promise<T>, ttlSeconds = CATALOG_TTL_SECONDS): Promise<T> {
  const version = await currentVersion();
  if (version === null) return load();
  const fullKey = `${version}:${key}`;
  try {
    const hit = await withTimeout(cacheGet<T>(NAMESPACE, fullKey), REDIS_BUDGET_MS, "catalog get");
    if (hit) return hit.value;
  } catch (err) {
    tripBreaker(err); // treat as a miss
  }

  // Coalesce concurrent misses for the same key into one database query.
  const pending = inflight.get(fullKey) as Promise<T> | undefined;
  if (pending) return pending;

  // Bounded so one hung query can't pin this key (and every coalesced waiter) forever.
  const promise = withTimeout(load(), LOAD_BUDGET_MS, "catalog load")
    .then(async (value) => {
      await withTimeout(cacheSet(NAMESPACE, fullKey, value, ttlSeconds), REDIS_BUDGET_MS, "catalog set").catch(tripBreaker);
      return value;
    })
    .finally(() => inflight.delete(fullKey));
  inflight.set(fullKey, promise);
  return promise;
}

// Stable key from normalised query params (sorted, blanks dropped).
export function catalogKey(prefix: string, params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    // Only the search text is case-insensitive; filters like packageType match exactly.
    .map(([key, value]) => `${key}=${key === "q" ? String(value).toLowerCase() : String(value)}`);
  return `${prefix}?${parts.join("&")}`;
}
