import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUOTA_HOLD_MS,
  TRANSIENT_HOLD_MS,
  WRITE_OK_TTL_MS,
  recordRedisFailure,
  recordRedisWriteOk,
  redisHealth,
  resetRedisHealth,
} from "../../src/lib/redis-health.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  resetRedisHealth();
});
afterEach(() => vi.useRealTimers());

describe("passive Redis health", () => {
  it("starts unknown: nothing has been observed, so nothing is claimed", () => {
    expect(redisHealth()).toBe("unknown");
  });

  it("a successful write makes it ok, and ok expires back to unknown (no stale 'healthy')", () => {
    recordRedisWriteOk();
    expect(redisHealth()).toBe("ok");
    vi.advanceTimersByTime(WRITE_OK_TTL_MS - 1);
    expect(redisHealth()).toBe("ok");
    vi.advanceTimersByTime(2);
    expect(redisHealth()).toBe("unknown");
  });

  it("a quota failure holds 'failing' for ten minutes with no further observations, then returns to unknown", () => {
    recordRedisFailure("quota");
    expect(redisHealth()).toBe("failing");
    vi.advanceTimersByTime(QUOTA_HOLD_MS - 1);
    expect(redisHealth()).toBe("failing");
    vi.advanceTimersByTime(2);
    expect(redisHealth()).toBe("unknown");
  });

  it("a transient failure (timeout, connection error) holds for only a minute", () => {
    recordRedisFailure("transient");
    vi.advanceTimersByTime(TRANSIENT_HOLD_MS - 1);
    expect(redisHealth()).toBe("failing");
    vi.advanceTimersByTime(2);
    expect(redisHealth()).toBe("unknown");
  });

  it("only a write success AFTER the failure clears it early", () => {
    recordRedisFailure("quota");
    recordRedisWriteOk();
    expect(redisHealth()).toBe("ok");
    recordRedisFailure("transient");
    expect(redisHealth()).toBe("failing"); // same millisecond: the later event wins
  });

  it("a write success BEFORE a failure does not hide the failure", () => {
    recordRedisWriteOk();
    recordRedisFailure("quota");
    expect(redisHealth()).toBe("failing");
  });

  it("a failure after a recovery starts a fresh hold: the old quota hold does not linger", () => {
    recordRedisFailure("quota");
    vi.advanceTimersByTime(60_000);
    recordRedisWriteOk(); // recovered
    vi.advanceTimersByTime(60_000);
    recordRedisFailure("transient");
    vi.advanceTimersByTime(TRANSIENT_HOLD_MS + 1_000);
    expect(redisHealth()).toBe("unknown"); // not still held until the first episode's ten minutes
  });

  it("a later transient failure never shortens an active quota hold", () => {
    recordRedisFailure("quota");
    vi.advanceTimersByTime(5 * 60_000);
    recordRedisFailure("transient");
    vi.advanceTimersByTime(TRANSIENT_HOLD_MS + 1_000); // transient hold alone would have expired
    expect(redisHealth()).toBe("failing");
    vi.advanceTimersByTime(QUOTA_HOLD_MS); // the quota hold has now certainly passed
    expect(redisHealth()).toBe("unknown");
  });
});
