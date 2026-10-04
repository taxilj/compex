import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queueAdd: vi.fn(),
  hexists: vi.fn(),
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
    client: Promise.resolve({ hexists: mocks.hexists }),
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
  BOM_QUEUE_UNAVAILABLE_MESSAGE,
  enqueueBomJob,
  isBomQueueAvailable,
  resetBomQueueHealth,
} from "../../src/modules/documents/documents.service.js";
import { pauseOnRedisError, reconnectDelay } from "../../src/lib/redis-options.js";

describe("BOM queue health and enqueue", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetBomQueueHealth();
    mocks.documentUpdate.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("reports available after a real Redis round trip succeeds, and caches it", async () => {
    mocks.hexists.mockResolvedValue(0);
    expect(await isBomQueueAvailable()).toBe(true);
    expect(await isBomQueueAvailable()).toBe(true);
    expect(mocks.hexists).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable when Redis rejects commands (e.g. Upstash quota exceeded)", async () => {
    mocks.hexists.mockRejectedValue(new Error("ERR max requests limit exceeded"));
    expect(await isBomQueueAvailable()).toBe(false);
  });

  it("reports unavailable when Redis does not answer within the probe timeout", async () => {
    vi.useFakeTimers();
    mocks.hexists.mockReturnValue(new Promise(() => undefined));
    const pending = isBomQueueAvailable();
    await vi.advanceTimersByTimeAsync(3_001);
    expect(await pending).toBe(false);
  });

  it("re-probes after the short unhealthy cool-down and notices recovery", async () => {
    vi.useFakeTimers();
    mocks.hexists.mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValue(0);
    expect(await isBomQueueAvailable()).toBe(false);
    expect(await isBomQueueAvailable()).toBe(false); // still inside the cool-down: no new probe
    expect(mocks.hexists).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_001);
    expect(await isBomQueueAvailable()).toBe(true);
  });

  it("coalesces concurrent probes into one Redis command", async () => {
    mocks.hexists.mockResolvedValue(0);
    await Promise.all([isBomQueueAvailable(), isBomQueueAvailable(), isBomQueueAvailable()]);
    expect(mocks.hexists).toHaveBeenCalledTimes(1);
  });

  it("enqueues with a per-document jobId so a duplicate add is a no-op", async () => {
    mocks.queueAdd.mockResolvedValue({ id: "bom-doc-1" });
    await enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" });
    expect(mocks.queueAdd).toHaveBeenCalledWith("parse-bom", { documentId: "doc-1", leadId: "lead-1" }, { jobId: "bom-doc-1" });
  });

  it("on enqueue failure marks the document FAILED (so re-upload works), returns 503 and flips capability off", async () => {
    mocks.queueAdd.mockRejectedValue(new Error("ERR max requests limit exceeded"));
    mocks.hexists.mockResolvedValue(0);

    await expect(enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" })).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.documentUpdate).toHaveBeenCalledWith({
      where: { id: "doc-1", processingStatus: "UPLOADED" },
      data: { processingStatus: "FAILED", processingError: BOM_QUEUE_UNAVAILABLE_MESSAGE },
    });
    expect(await isBomQueueAvailable()).toBe(false);
    expect(mocks.hexists).not.toHaveBeenCalled();
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

  it("pauses on a quota error, ignores the error burst, and resumes after the cool-down", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const worker = fakeWorker();
    pauseOnRedisError(worker, "bom-worker", 300_000);

    for (let i = 0; i < 20; i += 1) worker.fail(new Error("ERR max requests limit exceeded. Limit: 500000"));
    await Promise.resolve();

    expect(worker.pause).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(worker.isPaused()).toBe(true);

    await vi.advanceTimersByTimeAsync(300_001);
    expect(worker.resume).toHaveBeenCalledTimes(1);
    expect(worker.isPaused()).toBe(false);
    vi.useRealTimers();
  });
});

describe("worker circuit breaker ignores transient socket errors", () => {
  it("logs but does not pause on ECONNRESET", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let onError: (err: Error) => void = () => undefined;
    const worker = { on: (_e: "error", l: (err: Error) => void) => { onError = l; }, pause: vi.fn(async () => undefined), resume: vi.fn(), isPaused: () => false };
    pauseOnRedisError(worker, "bom-worker");
    onError(new Error("read ECONNRESET"));
    expect(worker.pause).not.toHaveBeenCalled();
  });
});
