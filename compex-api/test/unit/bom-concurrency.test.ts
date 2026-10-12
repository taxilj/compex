import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  status: "UPLOADED" as string,
  version: new Date("2026-01-01T00:00:00Z"),
  oldVersion: new Date("2026-01-01T00:00:00Z"),
  recoveredVersion: new Date("2026-01-01T00:01:00Z"),
  newVersion: new Date("2026-01-01T00:02:00Z"),
  claims: 0,
  parsedItems: 0,
  createManyCalls: 0,
  firstReadStarted: false,
  releaseFirstRead: undefined as (() => void) | undefined,
}));

vi.mock("bullmq", () => ({
  Worker: class {
    processor: (job: unknown) => Promise<void>;
    constructor(_name: string, processor: (job: unknown) => Promise<void>) { this.processor = processor; }
    on() {}
  },
}));
vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("../../src/config/env.js", () => ({ env: { REDIS_URL: "redis://qa.invalid:6381" } }));
vi.mock("../../src/modules/documents/documents.service.js", () => ({
  getStorage: () => ({
    readFile: async () => {
      if (!state.firstReadStarted) {
        state.firstReadStarted = true;
        await new Promise<void>((resolve) => { state.releaseFirstRead = resolve; });
      }
      return Buffer.from("mpn,manufacturer,quantity\nSTM32F103C8T6,ST,1\n");
    },
  }),
}));
vi.mock("../../src/modules/rfqs/rfq-line-number.js", () => ({ nextRfqItemLineNumber: async () => 1 }));
vi.mock("../../src/modules/leads/lead-line-number.js", () => ({ nextLeadItemLineNumber: async () => 1 }));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    document: {
      update: async ({ where }: { where: { processingStatus: string } }) => {
        if (where.processingStatus !== "UPLOADED" || state.status !== "UPLOADED") throw { code: "P2025" };
        state.status = "PROCESSING";
        state.claims += 1;
        state.version = state.claims === 1 ? state.oldVersion : state.newVersion;
        return { updatedAt: state.version };
      },
      findUniqueOrThrow: async () => ({ id: "doc-1", storageKey: "bom/leads/lead-1/x.csv" }),
      updateMany: async ({ where, data }: { where: { updatedAt: Date }; data: { processingStatus: string } }) => {
        if (where.updatedAt.getTime() !== state.version.getTime()) return { count: 0 };
        if (data.processingStatus === "COMPLETED") {
          state.status = "COMPLETED";
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<void>) => {
      let stagedItems = 0;
      const tx = {
        leadItem: { createMany: async () => { stagedItems += 1; state.createManyCalls += 1; } },
        rfqItem: { createMany: async () => { stagedItems += 1; state.createManyCalls += 1; } },
        document: { updateMany: async (args: { where: { updatedAt: Date }; data: { processingStatus: string } }) => {
          const result = await (await import("../../src/lib/prisma.js")).prisma.document.updateMany(args);
          if (result.count === 1) state.parsedItems += stagedItems;
          return result;
        } },
      };
      await callback(tx);
    },
  },
}));

import { startBomWorker } from "../../src/jobs/bom-processor.js";

describe("BOM worker ownership under stale recovery", () => {
  it("lets the replacement worker complete while the stale worker cannot append or overwrite", async () => {
    const first = (startBomWorker() as unknown as { processor: (job: unknown) => Promise<void> }).processor;
    const second = (startBomWorker() as unknown as { processor: (job: unknown) => Promise<void> }).processor;
    const job = { data: { documentId: "doc-1", leadId: "lead-1" } };

    const stale = first(job);
    while (!state.firstReadStarted) await new Promise((resolve) => setTimeout(resolve, 0));
    state.status = "UPLOADED";
    state.version = state.recoveredVersion;

    await second(job);
    state.releaseFirstRead?.();
    await expect(stale).rejects.toThrow();

    expect(state.claims).toBe(2);
    expect(state.createManyCalls).toBe(2); // stale transaction was rolled back by the real DB
    expect(state.parsedItems).toBe(1);
    expect(state.status).toBe("COMPLETED");
  });
});
