import { describe, expect, it, vi } from "vitest";

vi.mock("bullmq", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    Worker: class extends EventEmitter {
      paused = false;
      isPaused() { return this.paused; }
      async pause() { this.paused = true; }
      resume() { this.paused = false; }
    },
  };
});
vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("../../src/config/env.js", () => ({ env: { REDIS_URL: "redis://localhost:6379" } }));
vi.mock("../../src/lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../../src/modules/documents/documents.service.js", () => ({ getStorage: vi.fn() }));
vi.mock("../../src/lib/email.js", () => ({ sendEmail: vi.fn(), followUpEmail: vi.fn(), emailFailureReason: vi.fn(() => "Error") }));

import { EventEmitter } from "node:events";
import { startBomWorker } from "../../src/jobs/bom-processor.js";
import { startFollowUpWorker } from "../../src/jobs/follow-up-worker.js";

describe("queue outages keep the enquiry API alive", () => {
  it("BOM worker error events never throw and never expose raw Redis details", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const worker = startBomWorker() as unknown as EventEmitter;
    try {
      expect(() => worker.emit("error", new Error("quota exceeded synthetic-private-details"))).not.toThrow();
      expect(() => worker.emit("error", new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500002"))).not.toThrow();
      const logged = log.mock.calls.flat().join(" ");
      expect(log).toHaveBeenCalledTimes(1); // rate limited to one line per interval
      expect(logged).not.toContain("synthetic-private-details");
      expect(logged).not.toContain("500002");
    } finally {
      log.mockRestore();
    }
  });

  it("the follow-up sender uses no Redis, and a failing poll is logged without raw error text", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const poller = startFollowUpWorker(60_000);
    try {
      await poller.close(); // waits for the first poll, which fails: the prisma mock has no followUp model
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls.flat().join(" ")).toMatch(/\[follow-up\] poll failed: TypeError/);
      expect(log.mock.calls.flat().join(" ")).not.toContain("followUp");
    } finally {
      log.mockRestore();
    }
  });
});
