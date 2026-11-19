import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanDb, createTestApp, registerAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import { env } from "../../src/config/env.js";
import { startBomWorker } from "../../src/jobs/bom-processor.js";
import { recoverPendingBoms } from "../../src/jobs/bom-recovery.js";
import { recoverFailedNotifications } from "../../src/jobs/notification-recovery.js";
import { getBomQueue, resetBomQueueHealth } from "../../src/modules/documents/documents.service.js";

// Real local PostgreSQL, filesystem storage, Redis/BullMQ and test email outbox.
// Only explicit fault-injection cases replace one failing operation.
let app: FastifyInstance;
let worker: ReturnType<typeof startBomWorker>;
const persisted = new PrismaClient();
let outboxFailure: "none" | "always" | "once" = "none";
let outboxAttempts = 0;
const CSV = "mpn,manufacturer,quantity,description\nQA-WORKFLOW-001,QA Components,5,Synthetic row one\nQA-WORKFLOW-002,QA Components,7,Synthetic row two\n";

beforeAll(async () => {
  expect(env.NODE_ENV).toBe("test");
  expect(env.EMAIL_PROVIDER).toBe("test");
  expect(["127.0.0.1", "localhost"]).toContain(new URL(env.DATABASE_URL).hostname);
  expect(new URL(env.DATABASE_URL).pathname).toMatch(/_test$/);
  expect(["127.0.0.1", "localhost"]).toContain(new URL(env.REDIS_URL).hostname);
  prisma.$use(async (params, next) => {
    if (params.model === "TestEmail" && params.action === "create") {
      outboxAttempts += 1;
      if (outboxFailure === "always") throw new Error("synthetic-private-failure-marker");
      if (outboxFailure === "once") {
        outboxFailure = "none";
        throw Object.assign(new Error("synthetic transient failure"), { code: "ECONNREFUSED" });
      }
    }
    return next(params);
  });
  worker = startBomWorker();
  await worker.waitUntilReady();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  outboxFailure = "none";
  outboxAttempts = 0;
  if (app) await app.close();
  await cleanDb();
  resetBomQueueHealth();
  app = await createTestApp();
});

afterAll(async () => {
  vi.restoreAllMocks();
  if (app) await app.close();
  if (worker) await worker.close();
  const queue = getBomQueue();
  const client = await queue.client;
  await queue.close();
  await client.quit();
  await persisted.$disconnect();
  await prisma.$disconnect();
});

function enquiry(source: "CONTACT" | "REQUEST_QUOTE" | "BOM") {
  return {
    source,
    contactName: "Synthetic QA Contact",
    contactEmail: "workflow@invalid.test",
    companyName: "Synthetic QA Company",
    message: "Synthetic isolated workflow verification; no external delivery.",
    ...(source === "REQUEST_QUOTE" ? { items: [{ mpn: "QA-WORKFLOW-001", manufacturer: "QA Components", quantity: 5 }] } : {}),
  };
}

async function createEnquiry(source: "CONTACT" | "REQUEST_QUOTE" | "BOM", key = randomUUID()) {
  return app.inject({ method: "POST", url: "/api/v1/leads", headers: { "idempotency-key": key }, payload: enquiry(source) });
}

function multipart(fileName: string, content: string | Buffer, mime = "text/csv") {
  const boundary = `qa-${randomUUID()}`;
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`),
      Buffer.isBuffer(content) ? content : Buffer.from(content),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

async function upload(leadId: string, fileName = "synthetic.csv", content: string | Buffer = CSV, mime = "text/csv") {
  return app.inject({ method: "POST", url: `/api/v1/leads/${leadId}/bom`, ...multipart(fileName, content, mime) });
}

async function waitDocument(id: string, state: "COMPLETED" | "FAILED") {
  const until = Date.now() + 15_000;
  while (Date.now() < until) {
    const doc = await persisted.document.findUniqueOrThrow({ where: { id } });
    if (doc.processingStatus === state) return doc;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Synthetic document did not reach ${state}`);
}

describe("isolated enquiry persistence and retries", () => {
  it("persists a contact enquiry, audit and one test-outbox message across duplicate retries", async () => {
    const key = randomUUID();
    const first = await createEnquiry("CONTACT", key);
    expect(first.statusCode).toBe(201);
    const id = first.json().data.id;
    const repeated = await createEnquiry("CONTACT", key);
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().data.id).toBe(id);
    expect(await persisted.lead.count()).toBe(1);
    expect(await persisted.lead.findUniqueOrThrow({ where: { id } })).toMatchObject({ source: "CONTACT", notificationStatus: "SENT", contactEmail: "workflow@invalid.test" });
    expect(await persisted.testEmail.count()).toBe(1);
    expect((await persisted.testEmail.findFirstOrThrow()).to).toBe("sales@invalid.test");
    expect(await persisted.auditLog.count({ where: { action: "website_enquiry.created", entityId: id } })).toBe(1);
  });

  it("persists public quote lines without fabricating a customer-portal RFQ", async () => {
    const response = await createEnquiry("REQUEST_QUOTE");
    expect(response.statusCode).toBe(201);
    const lead = await persisted.lead.findUniqueOrThrow({ where: { id: response.json().data.id }, include: { items: true } });
    expect(lead).toMatchObject({ source: "REQUEST_QUOTE", notificationStatus: "SENT", rfqId: null });
    expect(lead.items).toHaveLength(1);
    expect(lead.items[0]).toMatchObject({ mpn: "QA-WORKFLOW-001", quantity: 5 });
    expect(await persisted.rfq.count()).toBe(0);
    expect((await persisted.testEmail.findFirstOrThrow()).html).toContain("QA-WORKFLOW-001");
  });

  it("rejects invalid quote and contact payloads without persistence or outbox side effects", async () => {
    for (const payload of [{ ...enquiry("REQUEST_QUOTE"), items: [] }, { ...enquiry("CONTACT"), contactEmail: "invalid-address" }]) {
      expect((await app.inject({ method: "POST", url: "/api/v1/leads", payload })).statusCode).toBe(400);
    }
    expect(await persisted.lead.count()).toBe(0);
    expect(await persisted.testEmail.count()).toBe(0);
  });

  it("serializes concurrent submissions with one idempotency key", async () => {
    const key = randomUUID();
    const responses = await Promise.all([createEnquiry("CONTACT", key), createEnquiry("CONTACT", key)]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 201]);
    expect(new Set(responses.map((r) => r.json().data.id)).size).toBe(1);
    expect(await persisted.lead.count()).toBe(1);
    expect(await persisted.testEmail.count()).toBe(1);
  });

  it("preserves an accepted enquiry when outbox delivery fails, then recovers it once", async () => {
    outboxFailure = "always";
    const response = await createEnquiry("CONTACT");
    expect(response.statusCode).toBe(201);
    expect(response.body).not.toContain("synthetic-private-failure-marker");
    const id = response.json().data.id;
    expect(await persisted.lead.findUniqueOrThrow({ where: { id } })).toMatchObject({ notificationStatus: "FAILED", notificationError: "Notification delivery failed" });
    expect(await persisted.testEmail.count()).toBe(0);
    outboxFailure = "none";
    await prisma.$executeRaw`UPDATE leads SET updated_at = ${new Date(Date.now() - 30 * 60_000)} WHERE id = ${id}::uuid`;
    expect(await recoverFailedNotifications()).toBe(1);
    expect(await recoverFailedNotifications()).toBe(0);
    expect((await persisted.lead.findUniqueOrThrow({ where: { id } })).notificationStatus).toBe("SENT");
    expect(await persisted.testEmail.count()).toBe(1);
    expect(await persisted.auditLog.count({ where: { action: "lead.notification_retry", entityId: id } })).toBe(1);
  });

  it("retries one transient outbox failure with one persisted message", async () => {
    outboxFailure = "once";
    const response = await createEnquiry("CONTACT");
    expect(response.statusCode).toBe(201);
    expect(outboxAttempts).toBe(2);
    expect(await persisted.testEmail.count()).toBe(1);
    expect((await persisted.lead.findUniqueOrThrow({ where: { id: response.json().data.id } })).notificationStatus).toBe("SENT");
  });
});

describe("isolated BOM validation, processing and recovery", () => {
  it("rejects unsupported extension, MIME, invalid XLSX signature and missing file", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    for (const [name, mime] of [["synthetic.exe", "application/octet-stream"], ["synthetic.csv", "image/png"], ["synthetic.xlsx", "application/octet-stream"]]) {
      const response = await upload(leadId, name, "not an XLSX archive", mime);
      expect(response.statusCode).toBe(400);
    }
    const boundary = `qa-${randomUUID()}`;
    expect((await app.inject({ method: "POST", url: `/api/v1/leads/${leadId}/bom`, headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: `--${boundary}--\r\n` })).statusCode).toBe(400);
    expect(await persisted.document.count()).toBe(0);
  });

  it("returns a client error for a non-multipart BOM request", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    const response = await app.inject({ method: "POST", url: `/api/v1/leads/${leadId}/bom`, payload: "" });
    expect(await persisted.document.count()).toBe(0);
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
  });

  it("rejects an oversized synthetic BOM with HTTP 413 and no stored document", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    const response = await upload(leadId, "oversized-synthetic.csv", Buffer.alloc(10 * 1024 * 1024 + 1, 65));
    expect(await persisted.document.count()).toBe(0);
    expect(response.statusCode).toBe(413);
  });

  it("parses a real synthetic CSV once despite concurrent uploads and retries", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    const responses = await Promise.all([upload(leadId), upload(leadId)]);
    expect(responses.map((r) => r.statusCode)).toEqual([202, 202]);
    const ids = responses.map((r) => r.json().data.documentId);
    expect(new Set(ids).size).toBe(1);
    await waitDocument(ids[0], "COMPLETED");
    const retry = await upload(leadId);
    expect(retry.json().data).toMatchObject({ documentId: ids[0], duplicate: true });
    expect(await persisted.document.count({ where: { leadId } })).toBe(1);
    expect(await persisted.leadItem.count({ where: { leadId } })).toBe(2);
    const status = await app.inject({ method: "GET", url: `/api/v1/leads/${leadId}/bom` });
    expect(status.json().data).toMatchObject({ processingStatus: "COMPLETED", validItemCount: 2 });
    expect(status.body).not.toContain("storageKey");
  });

  it("allows corrected re-upload after worker validation fails", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    const invalid = await upload(leadId, "empty-rows.csv", "mpn,quantity\n,0\n");
    expect(invalid.statusCode).toBe(202);
    const failedId = invalid.json().data.documentId;
    expect((await waitDocument(failedId, "FAILED")).processingError).toContain("No valid rows");
    expect(await persisted.leadItem.count()).toBe(0);
    const corrected = await upload(leadId);
    expect(corrected.statusCode).toBe(202);
    expect(corrected.json().data.documentId).not.toBe(failedId);
    await waitDocument(corrected.json().data.documentId, "COMPLETED");
    expect(await persisted.document.count({ where: { leadId } })).toBe(2);
    expect(await persisted.leadItem.count({ where: { leadId } })).toBe(2);
  });

  it("processes a genuine synthetic XLSX workbook", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ mpn: "QA-XLSX-001", quantity: 4 }, { mpn: "QA-XLSX-002", quantity: 8 }]), "Synthetic QA");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    const response = await upload(leadId, "synthetic.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.statusCode).toBe(202);
    await waitDocument(response.json().data.documentId, "COMPLETED");
    expect(await persisted.leadItem.findMany({ where: { leadId }, select: { mpn: true, quantity: true }, orderBy: { lineNumber: "asc" } })).toEqual([{ mpn: "QA-XLSX-001", quantity: 4 }, { mpn: "QA-XLSX-002", quantity: 8 }]);
  });

  it("recovers a stale processing claim with no committed rows", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    const response = await upload(leadId);
    const id = response.json().data.documentId;
    await waitDocument(id, "COMPLETED");
    // Synthetic crash fixture: PROCESSING owns no committed line items.
    await prisma.leadItem.deleteMany({ where: { leadId } });
    await prisma.document.update({ where: { id }, data: { processingStatus: "PROCESSING", updatedAt: new Date(Date.now() - 35 * 60_000) } });
    expect(await recoverPendingBoms(new Date(Date.now() + 3 * 60_000))).toBe(1);
    await waitDocument(id, "COMPLETED");
    expect(await persisted.leadItem.count({ where: { leadId } })).toBe(2);
    expect(await persisted.document.count({ where: { leadId } })).toBe(1);
  });

  it("retains the saved upload on enqueue failure and recovers the same document", async () => {
    const leadId = (await createEnquiry("BOM")).json().data.id;
    const queue = getBomQueue();
    const failure = vi.spyOn(queue, "add").mockRejectedValue(new Error("synthetic queue connection failure"));
    const response = await upload(leadId);
    expect(response.statusCode).toBe(503);
    expect(response.body).toContain("saved");
    const pending = await persisted.document.findFirstOrThrow({ where: { leadId } });
    expect(pending.processingStatus).toBe("UPLOADED");
    expect(await persisted.leadItem.count()).toBe(0);
    failure.mockRestore();
    resetBomQueueHealth();
    expect(await recoverPendingBoms(new Date(Date.now() + 3 * 60_000))).toBe(1);
    await waitDocument(pending.id, "COMPLETED");
    expect(await recoverPendingBoms(new Date(Date.now() + 3 * 60_000))).toBe(0);
    expect(await persisted.document.count({ where: { leadId } })).toBe(1);
    expect(await persisted.leadItem.count({ where: { leadId } })).toBe(2);
  });
});

describe("synthetic portal RFQ persistence", () => {
  it("does not append the same BOM rows twice when a completed upload is retried", async () => {
    const { accessToken } = await registerAndLogin(app, "portal-bom@invalid.test", "Synthetic BOM QA");
    const headers = { authorization: `Bearer ${accessToken}` };
    const created = await app.inject({ method: "POST", url: "/api/v1/rfqs", headers, payload: {} });
    const rfqId = created.json().data.id;
    const send = () => {
      const file = multipart("synthetic-portal.csv", CSV);
      return app.inject({ method: "POST", url: `/api/v1/rfqs/${rfqId}/bom`, ...file, headers: { ...file.headers, ...headers } });
    };
    const first = await send();
    expect(first.statusCode).toBe(202);
    await waitDocument(first.json().data.jobId, "COMPLETED");
    const repeated = await send();
    expect(repeated.statusCode).toBe(202);
    await waitDocument(repeated.json().data.jobId, "COMPLETED");
    expect.soft(await persisted.rfqItem.count({ where: { rfqId } })).toBe(2);
    expect.soft(await persisted.document.count({ where: { rfqId } })).toBe(1);
  });

  it("rejects empty submission, persists items and deduplicates concurrent submit", async () => {
    const { accessToken } = await registerAndLogin(app, "portal-workflow@invalid.test", "Synthetic QA");
    const headers = { authorization: `Bearer ${accessToken}` };
    const created = await app.inject({ method: "POST", url: "/api/v1/rfqs", headers, payload: { deliveryLocation: "Synthetic QA City" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    expect((await app.inject({ method: "POST", url: `/api/v1/rfqs/${id}/submit`, headers })).statusCode).toBe(422);
    expect((await app.inject({ method: "POST", url: `/api/v1/rfqs/${id}/items`, headers, payload: { mpn: "QA-PORTAL-001", quantity: 3 } })).statusCode).toBe(201);
    const submissions = await Promise.all([0, 1].map(() => app.inject({ method: "POST", url: `/api/v1/rfqs/${id}/submit`, headers })));
    expect(submissions.map((r) => r.statusCode).sort()).toEqual([200, 422]);
    expect((await persisted.rfq.findUniqueOrThrow({ where: { id }, include: { items: true } }))).toMatchObject({ status: "SUBMITTED", items: [{ mpn: "QA-PORTAL-001", quantity: 3 }] });
    expect(await persisted.lead.count({ where: { rfqId: id } })).toBe(1);
    const rfqNumber = created.json().data.rfqNumber;
    await expect.poll(async () => (await persisted.lead.findFirstOrThrow({ where: { rfqId: id } })).notificationStatus).toBe("SENT");
    expect(await persisted.testEmail.count({ where: { subject: `New RFQ — ${rfqNumber}`, to: "sales@invalid.test" } })).toBe(1);
    expect(await persisted.testEmail.count({ where: { subject: `RFQ Received — ${rfqNumber}`, to: "portal-workflow@invalid.test" } })).toBe(1);
  });
});
