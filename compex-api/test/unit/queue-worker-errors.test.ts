import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("bullmq", async () => {
  const { EventEmitter } = await import("node:events");
  return { Worker: class extends EventEmitter {} };
});
vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("../../src/config/env.js", () => ({ env: { REDIS_URL: "redis://localhost:6379" } }));
vi.mock("../../src/lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../../src/modules/documents/documents.service.js", () => ({ getStorage: vi.fn() }));
vi.mock("../../src/lib/email.js", () => ({ sendEmail: vi.fn(), followUpEmail: vi.fn() }));

import { startBomWorker } from "../../src/jobs/bom-processor.js";
import { startFollowUpWorker } from "../../src/jobs/follow-up-worker.js";

describe("queue outages keep the enquiry API alive", () => {
  it.each([startBomWorker, startFollowUpWorker])("handles worker error events without exposing raw Redis details", (start) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const worker = start() as unknown as EventEmitter;
    try {
      expect(() => worker.emit("error", new Error("quota exceeded synthetic-private-details"))).not.toThrow();
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls.flat().join(" ")).not.toContain("synthetic-private-details");
    } finally {
      log.mockRestore();
    }
  });
});
