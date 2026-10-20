import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queueAdd: vi.fn(),
  set: vi.fn(),
  documentUpdate: vi.fn(),
  headBucket: vi.fn(),
}));

vi.mock("../../src/config/env.js", () => ({
  env: { REDIS_URL: "redis://qa.invalid:6379", STORAGE_PROVIDER: "s3" },
}));
vi.mock("ioredis", () => ({ default: vi.fn() }));
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mocks.queueAdd,
    on: vi.fn(),
    client: Promise.resolve({ set: mocks.set }),
  })),
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { document: { updateMany: mocks.documentUpdate } },
}));
vi.mock("../../src/lib/storage/index.js", () => ({
  LocalStorageProvider: vi.fn(),
  S3StorageProvider: vi.fn().mockImplementation(() => ({ headBucket: mocks.headBucket })),
}));

import {
  enqueueBomJob,
  isBomQueueAvailable,
  resetBomQueueHealth,
} from "../../src/modules/documents/documents.service.js";
import { noteRedisError, pauseOnRedisError, reconnectDelay } from "../../src/lib/redis-options.js";
import { QUOTA_HOLD_MS, TRANSIENT_HOLD_MS, WRITE_OK_TTL_MS, recordRedisWriteOk, redisHealth } from "../../src/lib/redis-health.js";

const QUOTA_ERROR = () => new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500002");

describe("BOM capability reflects real Redis health", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetBomQueueHealth();
    mocks.documentUpdate.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("reports available after a real Redis WRITE succeeds, and does not probe again while that is fresh", async () => {
    mocks.set.mockResolvedValue("OK");
    expect(await isBomQueueAvailable()).toBe(true);
    expect(await isBomQueueAvailable()).toBe(true);
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith("compex:health:probe", "1", "EX", expect.any(Number));
  });

  it("reports unavailable when Redis rejects the write (provider quota exhausted)", async () => {
    mocks.set.mockRejectedValue(QUOTA_ERROR());
    expect(await isBomQueueAvailable()).toBe(false);
  });

  it("reports unavailable when Redis does not answer within the probe timeout", async () => {
    vi.useFakeTimers();
    mocks.set.mockReturnValue(new Promise(() => undefined));
    const pending = isBomQueueAvailable();
    await vi.advanceTimersByTimeAsync(3_001);
    expect(await pending).toBe(false);
  });

  it("after a quota failure, leaves Redis alone for the hold period, then probes once and notices recovery", async () => {
    vi.useFakeTimers();
    mocks.set.mockRejectedValueOnce(QUOTA_ERROR()).mockResolvedValue("OK");
    expect(await isBomQueueAvailable()).toBe(false);
    await vi.advanceTimersByTimeAsync(QUOTA_HOLD_MS - 5_000);
    expect(await isBomQueueAvailable()).toBe(false);
    expect(mocks.set).toHaveBeenCalledTimes(1); // no probe inside the hold
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await isBomQueueAvailable()).toBe(true);
    expect(mocks.set).toHaveBeenCalledTimes(2);
  });

  it("a transient failure (connection refused) blocks for only a minute", async () => {
    vi.useFakeTimers();
    mocks.set.mockRejectedValueOnce(new Error("connect ECONNREFUSED")).mockResolvedValue("OK");
    expect(await isBomQueueAvailable()).toBe(false);
    await vi.advanceTimersByTimeAsync(TRANSIENT_HOLD_MS + 1_000);
    expect(await isBomQueueAvailable()).toBe(true);
  });

  it("a Redis failure seen elsewhere (cache write, worker) makes it unavailable with no probe at all", async () => {
    noteRedisError(QUOTA_ERROR());
    expect(await isBomQueueAvailable()).toBe(false);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("a successful write seen elsewhere makes it available with no probe, until it goes stale", async () => {
    vi.useFakeTimers();
    mocks.set.mockResolvedValue("OK");
    recordRedisWriteOk();
    expect(await isBomQueueAvailable()).toBe(true);
    expect(mocks.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(WRITE_OK_TTL_MS + 1_000);
    expect(await isBomQueueAvailable()).toBe(true);
    expect(mocks.set).toHaveBeenCalledTimes(1); // stale evidence is re-checked once, not trusted
  });

  it("a successful READ elsewhere is not evidence of health (reads can pass while writes are rejected)", async () => {
    noteRedisError(QUOTA_ERROR());
    expect(redisHealth()).toBe("failing");
    // nothing in the read path calls recordRedisWriteOk, so the verdict stays failing
    expect(await isBomQueueAvailable()).toBe(false);
  });

  it("coalesces concurrent probes into one Redis command", async () => {
    mocks.set.mockResolvedValue("OK");
    await Promise.all([isBomQueueAvailable(), isBomQueueAvailable(), isBomQueueAvailable()]);
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  it("does not poll Redis while it is failing: 500 capability checks over eight minutes cost one command", async () => {
    vi.useFakeTimers();
    mocks.set.mockRejectedValue(QUOTA_ERROR());
    for (let i = 0; i < 500; i += 1) {
      await isBomQueueAvailable();
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  it("does not poll Redis while it is healthy: 500 checks over four minutes cost one command", async () => {
    vi.useFakeTimers();
    mocks.set.mockResolvedValue("OK");
    for (let i = 0; i < 500; i += 1) {
      await isBomQueueAvailable();
      await vi.advanceTimersByTimeAsync(480);
    }
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });
});

describe("BOM enqueue and upload persistence", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetBomQueueHealth();
    mocks.documentUpdate.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("enqueues with a per-document jobId so a duplicate add is a no-op", async () => {
    mocks.queueAdd.mockResolvedValue({ id: "bom-doc-1" });
    await enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" });
    expect(mocks.queueAdd).toHaveBeenCalledWith("parse-bom", { documentId: "doc-1", leadId: "lead-1" }, { jobId: "bom-doc-1", removeOnFail: true, removeOnComplete: true });
  });

  it("on enqueue failure the upload is retained as pending (never marked FAILED), returns 503 and flips capability off with no probe", async () => {
    mocks.queueAdd.mockRejectedValue(QUOTA_ERROR());
    const log = vi.spyOn(console, "error");

    await expect(enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" })).rejects.toMatchObject({ statusCode: 503 });
    // Any write would throw (the prisma mock exposes no document writes): the document stays UPLOADED.
    expect(mocks.documentUpdate).not.toHaveBeenCalled();
    expect(await isBomQueueAvailable()).toBe(false);
    expect(mocks.set).not.toHaveBeenCalled();
    // Logged by classification only: no usage numbers or raw Redis text.
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("document doc-1");
    expect(logged).not.toContain("500002");
  });

  it("while Redis is known to be failing, an upload is kept pending without sending Redis another command", async () => {
    noteRedisError(QUOTA_ERROR());
    await expect(enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" })).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.queueAdd).not.toHaveBeenCalled();
    expect(mocks.documentUpdate).not.toHaveBeenCalled(); // stored upload untouched, recovery re-enqueues it later
  });

  it("a successful enqueue is real write evidence: capability becomes available with no probe", async () => {
    mocks.queueAdd.mockResolvedValue({ id: "bom-doc-1" });
    await enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" });
    expect(await isBomQueueAvailable()).toBe(true);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("times out a hung enqueue instead of blocking the request", async () => {
    vi.useFakeTimers();
    mocks.queueAdd.mockReturnValue(new Promise(() => undefined));
    const pending = expect(enqueueBomJob("doc-1", { documentId: "doc-1" })).rejects.toMatchObject({ statusCode: 503 });
    await vi.advanceTimersByTimeAsync(5_001);
    await pending;
  });
});

describe("Redis reconnect policy", () => {
  it("backs off exponentially, caps at 30s and never gives up", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 50].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe("worker circuit breaker", () => {
  beforeEach(() => resetBomQueueHealth());

  function fakeWorker() {
    let paused = false;
    let onError: (err: Error) => void = () => undefined;
    return {
      on: (_event: "error", listener: (err: Error) => void) => { onError = listener; },
      pause: vi.fn(async () => { paused = true; }),
      resume: vi.fn(() => { paused = false; }),
      isPaused: () => paused,
      fail: (err: Error) => onError(err),
    };
  }

  it("pauses on a quota error, ignores the error burst, resumes after the cool-down, and tells the capability check", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const worker = fakeWorker();
    pauseOnRedisError(worker, "bom-worker", 300_000);

    for (let i = 0; i < 20; i += 1) worker.fail(QUOTA_ERROR());
    await Promise.resolve();

    expect(worker.pause).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(worker.isPaused()).toBe(true);
    expect(redisHealth()).toBe("failing");
    expect(await isBomQueueAvailable()).toBe(false);

    await vi.advanceTimersByTimeAsync(300_001);
    expect(worker.resume).toHaveBeenCalledTimes(1);
    expect(worker.isPaused()).toBe(false);
    vi.useRealTimers();
  });
});

describe("worker circuit breaker ignores transient socket errors for pausing", () => {
  it("logs and records a short failure but does not pause on ECONNRESET", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    resetBomQueueHealth();
    let onError: (err: Error) => void = () => undefined;
    const worker = { on: (_e: "error", l: (err: Error) => void) => { onError = l; }, pause: vi.fn(async () => undefined), resume: vi.fn(), isPaused: () => false };
    pauseOnRedisError(worker, "bom-worker");
    onError(new Error("read ECONNRESET"));
    expect(worker.pause).not.toHaveBeenCalled();
    expect(redisHealth()).toBe("failing");
  });
});
