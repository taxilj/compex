import { beforeEach, describe, expect, it, vi } from "vitest";

// Flow test for BOM enqueue recovery. Real enqueueBomJob/recoverPendingBoms run
// against an in-memory Document table and a fake queue that, like BullMQ, ignores
// a second add() with an existing jobId. The worker step mirrors bom-processor's
// UPLOADED -> PROCESSING claim (covered separately in bom-processor.test.ts).

interface Doc { rfq: { status: string } | null; updatedAt: Date; id: string; leadId: string | null; rfqId: string | null; customerId: string | null; documentType: "BOM"; processingStatus: string; createdAt: Date; items: number }

const sim = vi.hoisted(() => ({
  docs: new Map<string, Doc>(),
  jobs: new Map<string, { documentId: string }>(),
  queueDown: false,
  hexists: vi.fn(),
  writes: [] as string[],
  lastOpts: undefined as { jobId: string; removeOnFail?: boolean; removeOnComplete?: boolean } | undefined,
}));

vi.mock("../../src/config/env.js", () => ({ env: { REDIS_URL: "redis://qa.invalid:6379", STORAGE_PROVIDER: "s3" } }));
vi.mock("ioredis", () => ({ default: vi.fn() }));
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    client: Promise.resolve({
      hexists: async () => {
        if (sim.queueDown) throw new Error("ERR max requests limit exceeded");
        return 0;
      },
    }),
    add: async (_name: string, data: { documentId: string }, opts: { jobId: string; removeOnFail?: boolean; removeOnComplete?: boolean }) => {
      sim.lastOpts = opts;
      if (sim.queueDown) throw new Error("ERR max requests limit exceeded");
      if (!sim.jobs.has(opts.jobId)) sim.jobs.set(opts.jobId, data);
      return { id: opts.jobId };
    },
  })),
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    document: {
      findMany: async ({ where, take }: { where: { processingStatus: string; createdAt: { lt: Date; gt: Date } }; take: number }) =>
        [...sim.docs.values()]
          .filter((d) => d.processingStatus === where.processingStatus && d.createdAt < where.createdAt.lt && d.createdAt > where.createdAt.gt)
          .slice(0, take),
      count: async ({ where }: { where: { rfqId?: string; leadId?: string | null; createdAt: { gt: Date }; id: { not: string } } }) =>
        [...sim.docs.values()].filter((d) =>
          d.id !== where.id.not && d.createdAt > where.createdAt.gt &&
          (where.rfqId !== undefined ? d.rfqId === where.rfqId : d.leadId === where.leadId)).length,
      update: async () => { sim.writes.push("update"); },
      updateMany: async ({ where, data }: { where: { id?: string; processingStatus: string; updatedAt?: { lt: Date }; createdAt?: { gt: Date } }; data: { processingStatus: string } }) => {
        sim.writes.push("updateMany");
        const targets = where.id
          ? [sim.docs.get(where.id)].filter((d): d is Doc => !!d)
          : [...sim.docs.values()].filter((d) => d.updatedAt < where.updatedAt!.lt && (!where.createdAt || d.createdAt > where.createdAt.gt));
        let count = 0;
        for (const doc of targets) {
          if (doc.processingStatus !== where.processingStatus) continue;
          doc.processingStatus = data.processingStatus;
          count += 1;
        }
        return { count };
      },
    },
  },
}));
vi.mock("../../src/lib/storage/index.js", () => ({
  LocalStorageProvider: vi.fn(),
  S3StorageProvider: vi.fn().mockImplementation(() => ({ headBucket: async () => undefined })),
}));

import { enqueueBomJob, resetBomQueueHealth } from "../../src/modules/documents/documents.service.js";
import { recoverPendingBoms } from "../../src/jobs/bom-recovery.js";

const OLD = new Date(Date.now() - 10 * 60_000);
let parseRuns = 0;

// The worker: claim an UPLOADED document exactly once, "parse" it, complete it.
function runWorker() {
  for (const job of sim.jobs.values()) {
    const doc = sim.docs.get(job.documentId)!;
    if (doc.processingStatus !== "UPLOADED") continue;
    doc.processingStatus = "PROCESSING";
    parseRuns += 1;
    doc.items = 12;
    doc.processingStatus = "COMPLETED";
  }
}

function pendingDoc(id: string, overrides: Partial<Doc> = {}): Doc {
  const doc: Doc = { id, leadId: "lead-1", rfqId: null, customerId: null, documentType: "BOM", processingStatus: "UPLOADED", createdAt: OLD, updatedAt: OLD, items: 0, rfq: null, ...overrides };
  if (doc.rfqId && !overrides.rfq) doc.rfq = { status: "DRAFT" };
  sim.docs.set(id, doc);
  return doc;
}

describe("BOM enqueue recovery", () => {
  beforeEach(() => {
    sim.docs.clear();
    sim.jobs.clear();
    sim.writes.length = 0;
    sim.queueDown = false;
    parseRuns = 0;
    resetBomQueueHealth();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("first enqueue fails -> upload retained -> queue recovers -> same document is processed once with the right item count", async () => {
    pendingDoc("doc-1");
    sim.queueDown = true;

    await expect(enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" })).rejects.toMatchObject({ statusCode: 503 });
    expect(sim.docs.get("doc-1")).toMatchObject({ processingStatus: "UPLOADED" }); // retained, not FAILED
    expect(sim.writes).toEqual([]); // nothing deleted or rewritten
    expect(sim.jobs.size).toBe(0);

    // Still down: the sweep re-enqueues nothing and the document stays pending.
    expect(await recoverPendingBoms()).toBe(0);
    expect(sim.docs.get("doc-1")?.processingStatus).toBe("UPLOADED");

    sim.queueDown = false;
    resetBomQueueHealth(); // the cool-down expiring is modelled elsewhere
    expect(await recoverPendingBoms()).toBe(1);
    expect([...sim.jobs.keys()]).toEqual(["bom-doc-1"]);

    runWorker();
    expect(sim.docs.get("doc-1")).toMatchObject({ processingStatus: "COMPLETED", items: 12 });
    expect(parseRuns).toBe(1);
  });

  it("repeated sweeps and customer retries never create a second job or a second parse", async () => {
    pendingDoc("doc-1");
    await recoverPendingBoms();
    await recoverPendingBoms();
    await enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" }); // customer retry
    expect(sim.jobs.size).toBe(1);
    runWorker();
    runWorker();
    expect(parseRuns).toBe(1);
  });

  it("does not touch Redis at all when nothing is pending", async () => {
    pendingDoc("doc-done", { processingStatus: "COMPLETED" });
    sim.queueDown = true; // would throw if the queue were used
    await expect(recoverPendingBoms()).resolves.toBe(0);
  });

  it("ignores uploads younger than the pending threshold (a normal upload is still being picked up)", async () => {
    pendingDoc("doc-new", { createdAt: new Date() });
    expect(await recoverPendingBoms()).toBe(0);
    expect(sim.jobs.size).toBe(0);
  });

  it("carries the right payload for portal RFQ uploads as well as public leads", async () => {
    pendingDoc("doc-rfq", { leadId: null, rfqId: "rfq-9", customerId: "cust-3" });
    await recoverPendingBoms();
    expect(sim.jobs.get("bom-doc-rfq")).toEqual({ documentId: "doc-rfq", rfqId: "rfq-9", leadId: undefined, customerId: "cust-3" });
  });

  it("one document failing to enqueue does not stop the rest of the batch", async () => {
    pendingDoc("doc-a");
    pendingDoc("doc-b");
    const realAdd = sim.jobs.set.bind(sim.jobs);
    let calls = 0;
    sim.jobs.set = ((key: string, value: { documentId: string }) => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return realAdd(key, value);
    }) as typeof sim.jobs.set;
    await expect(recoverPendingBoms()).resolves.toBe(1);
    sim.jobs.set = realAdd;
    expect(sim.docs.get("doc-a")?.processingStatus).toBe("UPLOADED");
  });

  it("a customer re-upload after a 503 retires the older pending document instead of parsing both (no duplicate RFQ lines)", async () => {
    pendingDoc("doc-old", { leadId: null, rfqId: "rfq-9", customerId: "cust-3", createdAt: new Date(Date.now() - 20 * 60_000) });
    pendingDoc("doc-new", { leadId: null, rfqId: "rfq-9", customerId: "cust-3", createdAt: new Date(Date.now() - 10 * 60_000) });

    expect(await recoverPendingBoms()).toBe(1);
    expect(sim.docs.get("doc-old")).toMatchObject({ processingStatus: "FAILED" });
    expect([...sim.jobs.keys()]).toEqual(["bom-doc-new"]);
    runWorker();
    expect(parseRuns).toBe(1);
  });

  it("never auto-processes uploads older than 24 hours (e.g. leftovers from before this recovery existed)", async () => {
    pendingDoc("doc-ancient", { createdAt: new Date(Date.now() - 48 * 60 * 60_000) });
    expect(await recoverPendingBoms()).toBe(0);
    expect(sim.jobs.size).toBe(0);
    expect(sim.docs.get("doc-ancient")?.processingStatus).toBe("UPLOADED");
  });

  it("enqueues with removeOnFail so a job that failed before claiming the document can be re-added", async () => {
    await enqueueBomJob("doc-1", { documentId: "doc-1", leadId: "lead-1" });
    expect(sim.lastOpts).toEqual({ jobId: "bom-doc-1", removeOnFail: true, removeOnComplete: true });
  });

  it("a document stranded in PROCESSING (crash/redeploy) is handed back after 30 minutes and processed exactly once", async () => {
    pendingDoc("doc-stuck", { processingStatus: "PROCESSING", createdAt: new Date(Date.now() - 3 * 60 * 60_000), updatedAt: new Date(Date.now() - 45 * 60_000) });
    expect(await recoverPendingBoms()).toBe(1);
    expect(sim.docs.get("doc-stuck")?.processingStatus).toBe("UPLOADED");
    runWorker();
    expect(sim.docs.get("doc-stuck")).toMatchObject({ processingStatus: "COMPLETED", items: 12 });
    expect(parseRuns).toBe(1);
  });

  it("leaves a document that is legitimately PROCESSING (claimed minutes ago) alone", async () => {
    pendingDoc("doc-live", { processingStatus: "PROCESSING", updatedAt: new Date(Date.now() - 2 * 60_000) });
    expect(await recoverPendingBoms()).toBe(0);
    expect(sim.docs.get("doc-live")?.processingStatus).toBe("PROCESSING");
    expect(sim.jobs.size).toBe(0);
  });

  it("retires a pending BOM whose RFQ was submitted in the meantime instead of appending items to it", async () => {
    pendingDoc("doc-late", { leadId: null, rfqId: "rfq-7", customerId: "cust-3", rfq: { status: "SUBMITTED" } });
    expect(await recoverPendingBoms()).toBe(0);
    expect(sim.docs.get("doc-late")?.processingStatus).toBe("FAILED");
    expect(sim.jobs.size).toBe(0);
  });

  it("still recovers a pending BOM whose RFQ is still a DRAFT", async () => {
    pendingDoc("doc-draft", { leadId: null, rfqId: "rfq-8", customerId: "cust-3" });
    expect(await recoverPendingBoms()).toBe(1);
  });
});
