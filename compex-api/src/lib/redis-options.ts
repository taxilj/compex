import type { RedisOptions } from "ioredis";

// One connection policy for every Redis client in this process. Production
// Redis (Upstash) bills per command, so an outage must never turn into a tight
// reconnect or polling loop -- and a blip must recover without a restart.

const RECONNECT_MAX_DELAY_MS = 30_000;

// Exponential backoff (1s, 2s, 4s ... capped at 30s), never giving up. Returning
// null here would close the client for the life of the process.
export function reconnectDelay(times: number): number {
  return Math.min(1000 * 2 ** Math.min(Math.max(times, 1) - 1, 5), RECONNECT_MAX_DELAY_MS);
}

// Queue producers and the cache: fail a command fast while disconnected rather
// than queueing it behind an HTTP request.
export const FAIL_FAST_REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
  enableOfflineQueue: false,
  retryStrategy: reconnectDelay,
};

// BullMQ workers need maxRetriesPerRequest: null for their blocking commands.
export const WORKER_REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
  retryStrategy: reconnectDelay,
};

// BullMQ's defaults (5s drain poll, 30s stalled-job sweep, per worker) cost
// ~20k commands/day/worker while idle -- two idle workers alone exceed a 500k
// monthly quota. A job add still wakes a blocked worker immediately, so a long
// drain poll does not delay processing; it only stops empty polling.
export const WORKER_IDLE_OPTIONS = {
  drainDelay: 300, // seconds
  stalledInterval: 300_000, // ms
  runRetryDelay: 60_000, // ms between main-loop retries after a Redis error
} as const;

// One log line per interval so a Redis outage cannot flood the logs.
export function rateLimitedLogger(label: string, intervalMs = 60_000) {
  let lastLoggedAt = 0;
  return (err: unknown) => {
    if (Date.now() - lastLoggedAt < intervalMs) return;
    lastLoggedAt = Date.now();
    console.error(`[${label}] Redis error:`, err instanceof Error ? err.message : "Unknown error");
  };
}

export const WORKER_ERROR_COOLDOWN_MS = 5 * 60_000;

interface PausableWorker {
  on(event: "error", listener: (err: Error) => void): unknown;
  pause(doNotWaitActive?: boolean): Promise<void>;
  resume(): void;
  isPaused(): boolean;
}

// Quota/rate-limit replies: retrying sooner cannot succeed and only burns commands.
export function isRedisQuotaError(err: unknown): boolean {
  return err instanceof Error && /max (requests|daily request) limit|rate limit|max requests/i.test(err.message);
}

// Circuit breaker for a BullMQ worker. On a quota error (Upstash "max requests
// limit exceeded") BullMQ keeps re-polling several times a second, which is what
// drained the monthly quota. Pausing is local to this process (no Redis command),
// so exhaustion costs at most a few commands per cool-down. Ordinary socket
// errors are only logged: ioredis reconnects with backoff on its own, and
// pausing for them would stall a customer's BOM for minutes.
export function pauseOnRedisError(worker: PausableWorker, label: string, cooldownMs = WORKER_ERROR_COOLDOWN_MS): void {
  const log = rateLimitedLogger(label);
  worker.on("error", (err) => {
    log(err);
    if (!isRedisQuotaError(err) || worker.isPaused()) return;
    void worker.pause(true).catch(() => undefined);
    setTimeout(() => worker.resume(), cooldownMs).unref?.();
  });
}
