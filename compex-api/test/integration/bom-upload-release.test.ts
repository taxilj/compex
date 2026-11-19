import { randomUUID } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanDb, createTestApp, registerAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import { env } from "../../src/config/env.js";
import { startBomWorker } from "../../src/jobs/bom-processor.js";
import { getBomQueue, getStorage, resetBomQueueHealth } from "../../src/modules/documents/documents.service.js";

const CSV = "mpn,quantity\nQA-RELEASE-001,5\nQA-RELEASE-002,7\n";
const MAX_BYTES = 10 * 1024 * 1024;
let app: FastifyInstance;
let worker: ReturnType<typeof startBomWorker>;
let rejectDocument = false;

beforeAll(async () => {
  expect(env.NODE_ENV).toBe("test");
  expect(env.EMAIL_PROVIDER).toBe("test");
  expect(env.STORAGE_PROVIDER).toBe("local");
  expect(new URL(env.DATABASE_URL).hostname).toBe("127.0.0.1");
  expect(new URL(env.DATABASE_URL).pathname).toMatch(/_test$/);
  prisma.$use(async (params, next) => {
    if (rejectDocument && params.model === "Document" && params.action === "create") throw new Error("Synthetic document write failure");
    return next(params);
  });
  worker = startBomWorker();
  await worker.waitUntilReady();
});
beforeEach(async () => {
  vi.restoreAllMocks(); rejectDocument = false;
  if (app) await app.close();
  await cleanDb(); resetBomQueueHealth(); app = await createTestApp();
});
afterEach(async () => {
  rejectDocument = false; vi.restoreAllMocks(); await worker.resume();
  await expect.poll(async () => (await getBomQueue().getActiveCount()) + (await getBomQueue().getWaitingCount()), { timeout: 15000 }).toBe(0);
});
afterAll(async () => {
  await app.close(); await worker.close();
  const queue = getBomQueue(); const client = await queue.client;
  await queue.close(); await client.quit(); await prisma.$disconnect();
});

async function files() {
  const entries = await readdir(env.STORAGE_LOCAL_PATH, { recursive: true }).catch(() => [] as string[]);
  const existing = await Promise.all(entries.map(async (entry) => (await stat(path.join(env.STORAGE_LOCAL_PATH, entry))).isFile() ? entry : null));
  return existing.filter(Boolean).sort();
}
function multipart(content: string | Buffer = CSV, terminated = true) {
  const boundary = `qa-${randomUUID()}`;
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.csv"\r\nContent-Type: text/csv\r\n\r\n`),
    Buffer.isBuffer(content) ? content : Buffer.from(content), Buffer.from(terminated ? `\r\n--${boundary}--\r\n` : ""),
  ]) };
}
async function owner(kind: "portal" | "public") {
  if (kind === "public") {
    const response = await app.inject({ method: "POST", url: "/api/v1/leads", headers: { "idempotency-key": randomUUID() }, payload: { source: "BOM", contactName: "Synthetic QA", contactEmail: "release@invalid.test", companyName: "Synthetic QA", message: "Synthetic release verification" } });
    expect(response.statusCode).toBe(201);
    return { id: response.json().data.id as string, url: `/api/v1/leads/${response.json().data.id}/bom`, headers: {} as Record<string, string> };
  }
  const { accessToken } = await registerAndLogin(app, "release-portal@invalid.test", "Synthetic release");
  const headers = { authorization: `Bearer ${accessToken}` };
  const response = await app.inject({ method: "POST", url: "/api/v1/rfqs", headers, payload: {} });
  expect(response.statusCode).toBe(201);
  return { id: response.json().data.id as string, url: `/api/v1/rfqs/${response.json().data.id}/bom`, headers };
}
async function completed(id: string) {
  await expect.poll(async () => (await prisma.document.findUniqueOrThrow({ where: { id } })).processingStatus, { timeout: 15000 }).toBe("COMPLETED");
}
async function oneDocumentTwoLines(rfqId: string, id: string) {
  await completed(id);
  expect(await prisma.document.count({ where: { rfqId } })).toBe(1);
  expect(await prisma.rfqItem.findMany({ where: { rfqId }, select: { mpn: true, quantity: true }, orderBy: { lineNumber: "asc" } })).toEqual([{ mpn: "QA-RELEASE-001", quantity: 5 }, { mpn: "QA-RELEASE-002", quantity: 7 }]);
}

describe.each(["portal", "public"] as const)("%s BOM parser safety", (kind) => {
  it.each(["plain body", "missing boundary", "truncated multipart", "invalid JSON"])("rejects %s without persistence, storage or queue writes", async (scenario) => {
    const target = await owner(kind); const beforeFiles = await files(); const beforeRfqs = await prisma.rfq.count();
    const queue = vi.spyOn(getBomQueue(), "add"); const storage = vi.spyOn(getStorage(), "put");
    const request = scenario === "plain body" ? { headers: { "content-type": "text/plain" }, payload: "invalid" }
      : scenario === "missing boundary" ? { headers: { "content-type": "multipart/form-data" }, payload: "invalid" }
      : scenario === "invalid JSON" ? { headers: { "content-type": "application/json" }, payload: "{invalid" }
      : multipart(CSV, false);
    const response = await app.inject({ method: "POST", url: target.url, ...request, headers: { ...request.headers, ...target.headers } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(response.body).not.toMatch(/stack|boundary|Unexpected end|SyntaxError|SERVER_ERROR/);
    expect(await prisma.document.count()).toBe(0); expect(await prisma.rfq.count()).toBe(beforeRfqs);
    expect(await files()).toEqual(beforeFiles); expect(queue).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
  });
  it.each([true, false])("rejects just-over-limit file (complete multipart: %s) with 413 and no remnants", async (terminated) => {
    const target = await owner(kind); const beforeFiles = await files(); const beforeRfqs = await prisma.rfq.count();
    const queue = vi.spyOn(getBomQueue(), "add"); const storage = vi.spyOn(getStorage(), "put");
    const request = multipart(Buffer.alloc(MAX_BYTES + 1, 65), terminated);
    const response = await app.inject({ method: "POST", url: target.url, ...request, headers: { ...request.headers, ...target.headers } });
    expect(response.statusCode).toBe(413);
    expect(response.json().error).toEqual({ code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" });
    expect(await prisma.document.count()).toBe(0); expect(await prisma.rfq.count()).toBe(beforeRfqs);
    expect(await files()).toEqual(beforeFiles); expect(queue).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
  });
});

describe("portal BOM upload idempotency", () => {
  async function setup() {
    const target = await owner("portal"); const key = randomUUID();
    const send = (content = CSV, idempotencyKey = key) => {
      const request = multipart(content);
      return app.inject({ method: "POST", url: target.url, ...request, headers: { ...request.headers, ...target.headers, "idempotency-key": idempotencyKey } });
    };
    return { target, key, send };
  }
  it("first successful request persists one document and two lines", async () => {
    const { target, send } = await setup(); const result = await send(); expect(result.statusCode).toBe(202);
    await oneDocumentTwoLines(target.id, result.json().data.jobId);
    expect(await prisma.rfq.count()).toBe(1);
  });
  it("sequential replay while pending returns the original result", async () => {
    const { target, send } = await setup(); await worker.pause();
    const first = await send(); const second = await send();
    expect(first.statusCode).toBe(202); expect(second.statusCode).toBe(202); expect(second.json()).toEqual(first.json());
    expect(await prisma.document.count()).toBe(1); expect(await prisma.rfqItem.count()).toBe(0);
    await worker.resume(); await oneDocumentTwoLines(target.id, first.json().data.jobId);
  });
  it("concurrent same-key replay creates one document, file and effective parse", async () => {
    const { target, send } = await setup(); const before = (await files()).length;
    const results = await Promise.all([send(), send(), send()]);
    expect(results.map((r) => r.statusCode)).toEqual([202, 202, 202]);
    expect(new Set(results.map((r) => r.json().data.jobId)).size).toBe(1);
    await oneDocumentTwoLines(target.id, results[0].json().data.jobId); expect((await files()).length).toBe(before + 1);
  });
  it("completed replay returns the original result without another storage write", async () => {
    const { target, send } = await setup(); const first = await send(); await oneDocumentTwoLines(target.id, first.json().data.jobId);
    const put = vi.spyOn(getStorage(), "put"); const queue = vi.spyOn(getBomQueue(), "add");
    const replay = await send(); expect(replay.statusCode).toBe(202); expect(replay.json()).toEqual(first.json());
    await oneDocumentTwoLines(target.id, first.json().data.jobId); expect(put).not.toHaveBeenCalled(); expect(queue).not.toHaveBeenCalled();
  });
  it("enqueue failure retries the retained document and upload identity", async () => {
    const { target, send } = await setup(); const failure = vi.spyOn(getBomQueue(), "add").mockRejectedValueOnce(new Error("Synthetic enqueue outage"));
    expect((await send()).statusCode).toBe(503); const original = await prisma.document.findFirstOrThrow();
    expect(original.processingStatus).toBe("UPLOADED"); failure.mockRestore(); resetBomQueueHealth();
    const retry = await send(); expect(retry.statusCode).toBe(202); expect(retry.json().data.jobId).toBe(original.id);
    await oneDocumentTwoLines(target.id, original.id);
  });
  it("transaction failure cleans storage and permits the same-key retry", async () => {
    const { target, send } = await setup(); const beforeFiles = await files(); rejectDocument = true;
    expect((await send()).statusCode).toBe(500); rejectDocument = false;
    expect(await prisma.document.count()).toBe(0); expect(await prisma.rfqItem.count()).toBe(0); expect(await files()).toEqual(beforeFiles);
    const retry = await send(); expect(retry.statusCode).toBe(202); await oneDocumentTwoLines(target.id, retry.json().data.jobId);
  });
  it("partial storage failure leaves no object or record and permits retry", async () => {
    const { target, send } = await setup(); const storage = getStorage(); const put = storage.put.bind(storage); const beforeFiles = await files();
    const failed = vi.spyOn(storage, "put").mockImplementationOnce(async (...args) => { await put(...args); throw new Error("Synthetic storage write failure"); });
    expect((await send()).statusCode).toBe(500); failed.mockRestore();
    expect(await prisma.document.count()).toBe(0); expect(await files()).toEqual(beforeFiles);
    const retry = await send(); expect(retry.statusCode).toBe(202); await oneDocumentTwoLines(target.id, retry.json().data.jobId);
  });
  it("rejects different content under a completed key", async () => {
    const { target, send } = await setup(); const first = await send(); await completed(first.json().data.jobId);
    expect((await send(CSV.replace(",5", ",9"))).statusCode).toBe(409); await oneDocumentTwoLines(target.id, first.json().data.jobId);
  });
  it("rejects invalid keys before persistence", async () => {
    const { send } = await setup(); const beforeFiles = await files(); expect((await send(CSV, "invalid-key")).statusCode).toBe(400);
    expect(await prisma.document.count()).toBe(0); expect(await files()).toEqual(beforeFiles);
  });
  it("accepts exactly the maximum file size", async () => {
    const { target, send } = await setup();
    const prefix = "mpn,quantity,ignored\nQA-RELEASE-001,5,";
    const suffix = "\nQA-RELEASE-002,7,padding\n";
    const content = prefix + "x".repeat(MAX_BYTES - Buffer.byteLength(prefix + suffix)) + suffix;
    expect(Buffer.byteLength(content)).toBe(MAX_BYTES);
    const response = await send(content); expect(response.statusCode).toBe(202);
    await oneDocumentTwoLines(target.id, response.json().data.jobId);
  });
  it("replays a completed upload after the RFQ has been submitted", async () => {
    const { target, send } = await setup(); const first = await send(); await oneDocumentTwoLines(target.id, first.json().data.jobId);
    expect((await app.inject({ method: "POST", url: `/api/v1/rfqs/${target.id}/submit`, headers: target.headers })).statusCode).toBe(200);
    const replay = await send(); expect(replay.statusCode).toBe(202); expect(replay.json()).toEqual(first.json());
    await oneDocumentTwoLines(target.id, first.json().data.jobId);
    await expect.poll(async () => (await prisma.lead.findFirstOrThrow({ where: { rfqId: target.id } })).notificationStatus).toBe("SENT");
  });
  it("retries transient worker failure using the same document", async () => {
    const { target, send } = await setup();
    const failure = vi.spyOn(getStorage(), "readFile").mockRejectedValueOnce(new Error("Synthetic temporary storage outage"));
    const first = await send(); expect(first.statusCode).toBe(202); const id = first.json().data.jobId;
    await expect.poll(async () => (await prisma.document.findUniqueOrThrow({ where: { id } })).processingStatus).toBe("FAILED");
    await expect.poll(async () => getBomQueue().getJob(`bom-${id}`)).toBeUndefined();
    failure.mockRestore(); const retry = await send(); expect(retry.statusCode).toBe(202); expect(retry.json().data.jobId).toBe(id);
    await oneDocumentTwoLines(target.id, id);
  });
  it("concurrent different payloads under one key cannot leave an extra file", async () => {
    const { target, send } = await setup(); const before = (await files()).length;
    const responses = await Promise.all([send(), send(CSV.replace(",5", ",9"))]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([202, 409]);
    const winner = responses.find((r) => r.statusCode === 202)!;
    await completed(winner.json().data.jobId);
    expect(await prisma.document.count({ where: { rfqId: target.id } })).toBe(1);
    expect(await prisma.rfqItem.count({ where: { rfqId: target.id } })).toBe(2);
    expect((await files()).length).toBe(before + 1);
  });
  it("scopes the same key to each owned RFQ", async () => {
    const { target, key, send } = await setup(); const first = await send(); await completed(first.json().data.jobId);
    const created = await app.inject({ method: "POST", url: "/api/v1/rfqs", headers: target.headers, payload: {} });
    const otherId = created.json().data.id;
    const request = multipart();
    const other = await app.inject({ method: "POST", url: `/api/v1/rfqs/${otherId}/bom`, ...request, headers: { ...request.headers, ...target.headers, "idempotency-key": key } });
    expect(other.statusCode).toBe(202); expect(other.json().data.jobId).not.toBe(first.json().data.jobId);
    await oneDocumentTwoLines(target.id, first.json().data.jobId); await oneDocumentTwoLines(otherId, other.json().data.jobId);
  });
});
