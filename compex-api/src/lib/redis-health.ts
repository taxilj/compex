// Passive, in-process memory of whether Redis is really working, fed by whoever talks to it
// (catalogue cache, queue producer, BOM worker). It exists because a read can succeed while
// the provider rejects writes and queue commands once a quota is used up, so a read-only
// probe reports "available" for a Redis that cannot process BOMs.
//
// Rules: any failure is remembered for a hold period (longer for quota exhaustion, where
// retrying sooner cannot help and only burns commands); only a successful WRITE counts as
// evidence of health; with no recent evidence the state is "unknown" and a caller may spend
// one probe. It never makes a Redis call itself.

export const QUOTA_HOLD_MS = 10 * 60_000;
export const TRANSIENT_HOLD_MS = 60_000;
export const WRITE_OK_TTL_MS = 5 * 60_000;

export type RedisHealth = "failing" | "ok" | "unknown";

let sequence = 0;
let failureSeq = 0;
let writeOkSeq = 0;
let failingUntil = 0;
let writeOkAt = 0;

export function recordRedisFailure(kind: "quota" | "transient"): void {
  const until = Date.now() + (kind === "quota" ? QUOTA_HOLD_MS : TRANSIENT_HOLD_MS);
  // A longer hold is never shortened by a later failure, but a write success in between
  // ends the old episode: the next failure starts a fresh one.
  failingUntil = writeOkSeq > failureSeq ? until : Math.max(failingUntil, until);
  sequence += 1;
  failureSeq = sequence;
}

export function recordRedisWriteOk(): void {
  sequence += 1;
  writeOkSeq = sequence;
  writeOkAt = Date.now();
}

export function redisHealth(): RedisHealth {
  const now = Date.now();
  if (failureSeq > writeOkSeq && now < failingUntil) return "failing";
  if (writeOkSeq > failureSeq && now - writeOkAt < WRITE_OK_TTL_MS) return "ok";
  return "unknown";
}

// Test hook.
export function resetRedisHealth(): void {
  sequence = 0;
  failureSeq = 0;
  writeOkSeq = 0;
  failingUntil = 0;
  writeOkAt = 0;
}
