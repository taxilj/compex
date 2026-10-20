import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
  handlers: {} as Record<string, (error?: Error) => void>,
}));

vi.mock("../../src/config/env.js", () => ({ env: { REDIS_URL: "redis://qa.invalid:6379" } }));
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    get: redis.get,
    set: redis.set,
    incrby: redis.incrby,
    expire: redis.expire,
    del: redis.del,
    on: (event: string, handler: (error?: Error) => void) => {
      redis.handlers[event] = handler;
    },
  })),
}));

import { cacheGet, cacheSet, incrementCounter } from "../../src/lib/cache.js";
import { cachedCatalog, resetCatalogBreaker } from "../../src/modules/catalog/catalog-cache.js";
import { redisHealth, resetRedisHealth } from "../../src/lib/redis-health.js";

const QUOTA_ERROR = () => new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500002");

beforeEach(() => {
  vi.clearAllMocks();
  resetRedisHealth();
  resetCatalogBreaker();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe("cache layer feeds and survives Redis failure", () => {
  it("a failed read is a cache miss, never an error, and marks Redis failing", async () => {
    redis.get.mockRejectedValue(QUOTA_ERROR());
    await expect(cacheGet("ns", "k")).resolves.toBeNull();
    expect(redisHealth()).toBe("failing");
  });

  it("a rejected write is swallowed and marks Redis failing", async () => {
    redis.set.mockRejectedValue(QUOTA_ERROR());
    await expect(cacheSet("ns", "k", { a: 1 }, 60)).resolves.toBeUndefined();
    expect(redisHealth()).toBe("failing");
  });

  it("a successful write is the evidence that marks Redis ok", async () => {
    redis.set.mockResolvedValue("OK");
    await cacheSet("ns", "k", { a: 1 }, 60);
    expect(redisHealth()).toBe("ok");
  });

  it("a successful read does NOT clear a failure (reads can pass while writes are rejected)", async () => {
    redis.set.mockRejectedValue(QUOTA_ERROR());
    await cacheSet("ns", "k", { a: 1 }, 60);
    redis.get.mockResolvedValue(JSON.stringify({ value: 1, cachedAt: "x" }));
    await expect(cacheGet("ns", "k")).resolves.toMatchObject({ value: 1 });
    expect(redisHealth()).toBe("failing");
  });

  it("a connection error event is recorded and never thrown into the process", async () => {
    redis.get.mockResolvedValue(null);
    await cacheGet("ns", "k"); // creates the client and registers its listeners
    expect(() => redis.handlers.error!(new Error("connect ECONNREFUSED"))).not.toThrow();
    expect(redisHealth()).toBe("failing");
  });

  it("counters fail open (0) on a Redis error and record it; a success is write evidence", async () => {
    redis.incrby.mockRejectedValue(QUOTA_ERROR());
    await expect(incrementCounter("ns", "k", 60)).resolves.toBe(0);
    expect(redisHealth()).toBe("failing");

    resetRedisHealth();
    redis.incrby.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    await expect(incrementCounter("ns", "k", 60)).resolves.toBe(1);
    expect(redisHealth()).toBe("ok");
  });
});

describe("catalogue requests keep a database fallback when Redis fails", () => {
  it("serves from the loader when the cache read is rejected, and records the failure", async () => {
    redis.get.mockRejectedValue(QUOTA_ERROR());
    redis.set.mockRejectedValue(QUOTA_ERROR());
    const loader = vi.fn().mockResolvedValue({ rows: 3 });

    await expect(cachedCatalog("categories?", loader)).resolves.toEqual({ rows: 3 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redisHealth()).toBe("failing");
  });

  it("serves from the loader when Redis never answers, within the Redis time budget", async () => {
    vi.useFakeTimers();
    redis.get.mockReturnValue(new Promise(() => undefined));
    const loader = vi.fn().mockResolvedValue({ rows: 5 });

    const pending = cachedCatalog("products?", loader);
    await vi.advanceTimersByTimeAsync(400);
    await expect(pending).resolves.toEqual({ rows: 5 });
    expect(redisHealth()).toBe("failing");
  });

  it("skips Redis entirely during the breaker cool-down instead of paying the timeout again", async () => {
    vi.useFakeTimers();
    redis.get.mockReturnValue(new Promise(() => undefined));
    const loader = vi.fn().mockResolvedValue({ rows: 1 });

    const first = cachedCatalog("a?", loader);
    await vi.advanceTimersByTimeAsync(400);
    await first;
    redis.get.mockClear();
    await cachedCatalog("b?", loader);
    expect(redis.get).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
