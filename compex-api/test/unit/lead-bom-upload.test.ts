import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  documentFindFirst: vi.fn(),
  documentCreate: vi.fn(),
  leadItemCount: vi.fn(),
  audit: vi.fn(),
  storagePut: vi.fn(),
  storageDelete: vi.fn(),
  queueAdd: vi.fn(),
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    lead: { findUnique: mocks.leadFindUnique },
    document: { findFirst: mocks.documentFindFirst, create: mocks.documentCreate },
    leadItem: { count: mocks.leadItemCount },
    // The authoritative existing-document check + create runs inside a
    // transaction under an advisory lock (see lead-bom-upload.ts) -- routed
    // through the same mocks so tests configure one set of expectations.
    $transaction: (cb: (tx: unknown) => unknown) => cb({
      document: { findFirst: mocks.documentFindFirst, create: mocks.documentCreate },
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));
vi.mock("../../src/lib/audit.js", () => ({ audit: mocks.audit }));
vi.mock("../../src/modules/documents/documents.service.js", () => ({
  getStorage: () => ({ put: mocks.storagePut, delete: mocks.storageDelete }),
  getBomQueue: () => ({ add: mocks.queueAdd }),
}));

import { leadBomUploadHandler, getLeadBomStatus } from "../../src/modules/leads/lead-bom-upload.js";

const BOM_LEAD = { id: "lead-1", source: "BOM" };

function fakeRequest(file: { filename: string; mimetype: string; buffer: Buffer } | null) {
  return {
    ip: "203.0.113.1",
    headers: { "user-agent": "vitest" },
    file: vi.fn().mockResolvedValue(
      file
        ? { filename: file.filename, mimetype: file.mimetype, toBuffer: async () => file.buffer }
        : null,
    ),
  } as unknown as Parameters<typeof leadBomUploadHandler>[0];
}

const validXlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16)]);

describe("lead BOM upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.leadFindUnique.mockResolvedValue(BOM_LEAD);
    mocks.documentFindFirst.mockResolvedValue(null);
    mocks.storagePut.mockResolvedValue(undefined);
    mocks.storageDelete.mockResolvedValue(undefined);
    mocks.queueAdd.mockResolvedValue(undefined);
  });

  it("404s for a lead that does not exist", async () => {
    mocks.leadFindUnique.mockResolvedValue(null);
    await expect(leadBomUploadHandler(fakeRequest(null), "missing")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s for a lead whose source is not BOM (never leaks existence)", async () => {
    mocks.leadFindUnique.mockResolvedValue({ id: "lead-1", source: "CONTACT" });
    await expect(leadBomUploadHandler(fakeRequest(null), "lead-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("stores a valid xlsx, persists metadata, and enqueues processing without leaking storageKey", async () => {
    mocks.documentCreate.mockResolvedValue({
      id: "doc-1",
      fileName: "bom.xlsx",
      processingStatus: "UPLOADED",
      processingError: null,
      fileSizeBytes: validXlsx.length,
    });

    const result = await leadBomUploadHandler(
      fakeRequest({ filename: "bom.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: validXlsx }),
      "lead-1",
    );

    expect(mocks.storagePut).toHaveBeenCalledWith(
      expect.stringMatching(/^bom\/leads\/lead-1\//),
      validXlsx,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(mocks.documentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ leadId: "lead-1", documentType: "BOM", processingStatus: "UPLOADED" }),
    }));
    expect(mocks.queueAdd).toHaveBeenCalledWith("parse-bom", { documentId: "doc-1", leadId: "lead-1" });
    expect(result).toEqual({
      documentId: "doc-1",
      fileName: "bom.xlsx",
      processingStatus: "UPLOADED",
      processingError: null,
      fileSizeBytes: validXlsx.length,
      duplicate: false,
    });
    expect(result).not.toHaveProperty("storageKey");
  });

  it("rejects an unsupported extension without touching storage", async () => {
    await expect(leadBomUploadHandler(
      fakeRequest({ filename: "bom.pdf", mimetype: "application/pdf", buffer: validXlsx }),
      "lead-1",
    )).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejects an invalid MIME type even with an allowed extension", async () => {
    await expect(leadBomUploadHandler(
      fakeRequest({ filename: "bom.xlsx", mimetype: "application/x-msdownload", buffer: validXlsx }),
      "lead-1",
    )).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejects a file over the 10 MB limit", async () => {
    const big = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(10 * 1024 * 1024)]);
    await expect(leadBomUploadHandler(
      fakeRequest({ filename: "bom.xlsx", mimetype: "text/csv", buffer: big }),
      "lead-1",
    )).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejects an xlsx whose bytes do not match the PK zip signature", async () => {
    const fake = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    await expect(leadBomUploadHandler(
      fakeRequest({ filename: "bom.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: fake }),
      "lead-1",
    )).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("is idempotent: a retry returns the existing document instead of creating a duplicate", async () => {
    mocks.documentFindFirst.mockResolvedValue({
      id: "doc-existing",
      fileName: "bom.xlsx",
      processingStatus: "COMPLETED",
      processingError: null,
      fileSizeBytes: 1234,
    });

    const result = await leadBomUploadHandler(
      fakeRequest({ filename: "bom.xlsx", mimetype: "text/csv", buffer: validXlsx }),
      "lead-1",
    );

    expect(result.duplicate).toBe(true);
    expect(result.documentId).toBe("doc-existing");
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.documentCreate).not.toHaveBeenCalled();
  });

  it("allows a fresh upload after a FAILED document, instead of replaying the same failure forever", async () => {
    mocks.documentFindFirst.mockResolvedValue({
      id: "doc-failed",
      fileName: "bad.xlsx",
      processingStatus: "FAILED",
      processingError: "No valid rows found in BOM (mpn + quantity required)",
      fileSizeBytes: 900,
    });
    mocks.documentCreate.mockResolvedValue({
      id: "doc-2",
      fileName: "fixed.xlsx",
      processingStatus: "UPLOADED",
      processingError: null,
      fileSizeBytes: validXlsx.length,
    });

    const result = await leadBomUploadHandler(
      fakeRequest({ filename: "fixed.xlsx", mimetype: "text/csv", buffer: validXlsx }),
      "lead-1",
    );

    expect(mocks.storagePut).toHaveBeenCalled();
    expect(mocks.documentCreate).toHaveBeenCalled();
    expect(result).toMatchObject({ documentId: "doc-2", duplicate: false });
  });

  it("loses a concurrent-upload race safely: cleans up its own storage write and reports the winner's document instead of double-creating", async () => {
    // The fast pre-check sees nothing (no upload has landed yet), but by the
    // time this request reaches the advisory-locked re-check inside the
    // transaction, a concurrent request has already created a live document
    // for the same lead.
    mocks.documentFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "doc-winner",
        fileName: "winner.xlsx",
        processingStatus: "UPLOADED",
        processingError: null,
        fileSizeBytes: 999,
      });

    const result = await leadBomUploadHandler(
      fakeRequest({ filename: "loser.xlsx", mimetype: "text/csv", buffer: validXlsx }),
      "lead-1",
    );

    expect(result).toEqual({
      documentId: "doc-winner",
      fileName: "winner.xlsx",
      processingStatus: "UPLOADED",
      processingError: null,
      fileSizeBytes: 999,
      duplicate: true,
    });
    // Its own file was already written to storage before losing the race --
    // must be cleaned up rather than left as an orphaned object.
    expect(mocks.storageDelete).toHaveBeenCalled();
    expect(mocks.documentCreate).not.toHaveBeenCalled();
    expect(mocks.queueAdd).not.toHaveBeenCalled();
  });

  it("cleans up the orphaned storage object when the database write fails", async () => {
    mocks.documentCreate.mockRejectedValue(new Error("db unavailable"));

    await expect(leadBomUploadHandler(
      fakeRequest({ filename: "bom.xlsx", mimetype: "text/csv", buffer: validXlsx }),
      "lead-1",
    )).rejects.toThrow("db unavailable");

    expect(mocks.storagePut).toHaveBeenCalled();
    expect(mocks.storageDelete).toHaveBeenCalledWith(expect.stringMatching(/^bom\/leads\/lead-1\//));
  });

  it("returns a safe 503 when the file and DB row are saved but the queue is unavailable", async () => {
    mocks.documentCreate.mockResolvedValue({
      id: "doc-1",
      fileName: "bom.xlsx",
      processingStatus: "UPLOADED",
      processingError: null,
      fileSizeBytes: validXlsx.length,
    });
    mocks.queueAdd.mockRejectedValue(new Error("redis down"));

    await expect(leadBomUploadHandler(
      fakeRequest({ filename: "bom.xlsx", mimetype: "text/csv", buffer: validXlsx }),
      "lead-1",
    )).rejects.toMatchObject({ statusCode: 503 });

    // The document was already durably persisted -- a queue failure must not
    // trigger storage/document cleanup, only a clear "try again" response.
    expect(mocks.storageDelete).not.toHaveBeenCalled();
  });

  it("throws 400 when no file is uploaded", async () => {
    await expect(leadBomUploadHandler(fakeRequest(null), "lead-1")).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("lead BOM status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.leadFindUnique.mockResolvedValue(BOM_LEAD);
  });

  it("404s when no document has been uploaded yet", async () => {
    mocks.documentFindFirst.mockResolvedValue(null);
    await expect(getLeadBomStatus("lead-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("omits validItemCount while still processing", async () => {
    mocks.documentFindFirst.mockResolvedValue({
      id: "doc-1", fileName: "bom.xlsx", processingStatus: "PROCESSING", processingError: null, fileSizeBytes: 100,
    });
    const result = await getLeadBomStatus("lead-1");
    expect(result.validItemCount).toBeUndefined();
    expect(mocks.leadItemCount).not.toHaveBeenCalled();
  });

  it("omits validItemCount after a failure and surfaces the honest error", async () => {
    mocks.documentFindFirst.mockResolvedValue({
      id: "doc-1", fileName: "bom.xlsx", processingStatus: "FAILED", processingError: "No valid rows found", fileSizeBytes: 100,
    });
    const result = await getLeadBomStatus("lead-1");
    expect(result.validItemCount).toBeUndefined();
    expect(result.processingError).toBe("No valid rows found");
  });

  it("reports the real parsed line-item count only once processing has completed", async () => {
    mocks.documentFindFirst.mockResolvedValue({
      id: "doc-1", fileName: "bom.xlsx", processingStatus: "COMPLETED", processingError: null, fileSizeBytes: 100,
    });
    mocks.leadItemCount.mockResolvedValue(7);
    const result = await getLeadBomStatus("lead-1");
    expect(result.validItemCount).toBe(7);
  });

  it("404s for a lead whose source is not BOM", async () => {
    mocks.leadFindUnique.mockResolvedValue({ id: "lead-1", source: "CONTACT" });
    await expect(getLeadBomStatus("lead-1")).rejects.toMatchObject({ statusCode: 404 });
  });
});
