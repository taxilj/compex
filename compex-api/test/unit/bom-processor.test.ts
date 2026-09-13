import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  documentUpdate: vi.fn(),
  transaction: vi.fn(),
  leadItemCreateMany: vi.fn(),
  rfqItemCreateMany: vi.fn(),
  readFile: vi.fn(),
  nextRfqLine: vi.fn(),
  nextLeadLine: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(public name: string, public processor: (job: unknown) => Promise<void>) {}
    on() {}
  },
}));
vi.mock("ioredis", () => ({ default: class {} }));
vi.mock("../../src/config/env.js", () => ({ env: { REDIS_URL: "redis://localhost:6379" } }));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    document: { updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow, update: mocks.documentUpdate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../src/modules/documents/documents.service.js", () => ({
  getStorage: () => ({ readFile: mocks.readFile }),
}));
vi.mock("../../src/modules/rfqs/rfq-line-number.js", () => ({ nextRfqItemLineNumber: mocks.nextRfqLine }));
vi.mock("../../src/modules/leads/lead-line-number.js", () => ({ nextLeadItemLineNumber: mocks.nextLeadLine }));

import { startBomWorker } from "../../src/jobs/bom-processor.js";

const CSV = "mpn,manufacturer,quantity\nSTM32F103C8T6,ST,100\n";

function txStub() {
  return { leadItem: { createMany: mocks.leadItemCreateMany }, rfqItem: { createMany: mocks.rfqItemCreateMany }, document: { update: mocks.documentUpdate } };
}

describe("bom-processor worker", () => {
  let process: (job: { data: unknown }) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    process = (startBomWorker() as unknown as { processor: typeof process }).processor;
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.readFile.mockResolvedValue(Buffer.from(CSV));
    mocks.nextRfqLine.mockResolvedValue(1);
    mocks.nextLeadLine.mockResolvedValue(1);
    mocks.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(txStub()));
  });

  it("appends parsed rows to LeadItem when the job carries a leadId", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "doc-1", storageKey: "bom/leads/lead-1/x.csv" });

    await process({ data: { documentId: "doc-1", leadId: "lead-1" } });

    expect(mocks.leadItemCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ leadId: "lead-1", lineNumber: 1, mpn: "STM32F103C8T6", quantity: 100 })],
    });
    expect(mocks.rfqItemCreateMany).not.toHaveBeenCalled();
    expect(mocks.documentUpdate).toHaveBeenCalledWith({ where: { id: "doc-1" }, data: { processingStatus: "COMPLETED" } });
  });

  it("still appends to RfqItem (with pricing) when the job carries an rfqId, unaffected by the lead branch", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "doc-2", storageKey: "bom/cust-1/rfq-1/x.csv" });

    await process({ data: { documentId: "doc-2", rfqId: "rfq-1" } });

    expect(mocks.rfqItemCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ rfqId: "rfq-1", lineNumber: 1, mpn: "STM32F103C8T6" })],
    });
    expect(mocks.leadItemCreateMany).not.toHaveBeenCalled();
  });

  it("marks the document FAILED and never claims success when neither rfqId nor leadId is present, without leaking the internal error to the public status field", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "doc-3", storageKey: "bom/orphan/x.csv" });

    await expect(process({ data: { documentId: "doc-3" } })).rejects.toThrow("missing both rfqId and leadId");

    expect(mocks.leadItemCreateMany).not.toHaveBeenCalled();
    expect(mocks.rfqItemCreateMany).not.toHaveBeenCalled();
    expect(mocks.documentUpdate).toHaveBeenCalledWith({
      where: { id: "doc-3" },
      data: { processingStatus: "FAILED", processingError: "The BOM file could not be processed. Please check the file and try again." },
    });
  });

  it("marks FAILED with an honest error when the file has no valid rows, without creating any items", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "doc-4", storageKey: "bom/leads/lead-1/empty.csv" });
    mocks.readFile.mockResolvedValue(Buffer.from("mpn,quantity\n,\n"));

    await expect(process({ data: { documentId: "doc-4", leadId: "lead-1" } })).rejects.toThrow("No valid rows");

    expect(mocks.leadItemCreateMany).not.toHaveBeenCalled();
    expect(mocks.documentUpdate).toHaveBeenCalledWith({
      where: { id: "doc-4" },
      data: { processingStatus: "FAILED", processingError: expect.stringContaining("No valid rows") },
    });
  });

  it("rejects an oversized CSV honestly instead of silently truncating it", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "doc-6", storageKey: "bom/leads/lead-1/huge.csv" });
    const header = "mpn,quantity\n";
    const rows = Array.from({ length: 20_001 }, (_, i) => `MPN${i},1`).join("\n");
    mocks.readFile.mockResolvedValue(Buffer.from(header + rows));

    await expect(process({ data: { documentId: "doc-6", leadId: "lead-1" } })).rejects.toThrow(/exceeds the maximum/);

    expect(mocks.leadItemCreateMany).not.toHaveBeenCalled();
    expect(mocks.documentUpdate).toHaveBeenCalledWith({
      where: { id: "doc-6" },
      data: { processingStatus: "FAILED", processingError: expect.stringContaining("exceeds the maximum") },
    });
  });

  it("never leaks a raw internal error (e.g. a storage/filesystem failure) to the public processingError field", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "doc-7", storageKey: "bom/leads/lead-1/x.csv" });
    mocks.readFile.mockRejectedValue(new Error("ENOENT: no such file or directory, open 'C:\\secret\\internal\\path\\x.csv'"));

    await expect(process({ data: { documentId: "doc-7", leadId: "lead-1" } })).rejects.toThrow("ENOENT");

    expect(mocks.documentUpdate).toHaveBeenCalledWith({
      where: { id: "doc-7" },
      data: { processingStatus: "FAILED", processingError: "The BOM file could not be processed. Please check the file and try again." },
    });
  });

  it("skips a duplicate delivery: a document no longer UPLOADED is never reprocessed", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await process({ data: { documentId: "doc-5", leadId: "lead-1" } });

    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(mocks.leadItemCreateMany).not.toHaveBeenCalled();
  });
});
