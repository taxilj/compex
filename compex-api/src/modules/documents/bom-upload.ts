import type { FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { auditInTx } from "../../lib/audit.js";
import { describeError } from "../../lib/safe-log.js";
import { getStorage, enqueueBomJob } from "./documents.service.js";
import { readBomFile } from "./bom-file.js";

export { ALLOWED_MIMES, ALLOWED_EXTS, MAX_BYTES } from "./bom-file.js";

function result(id: string) { return { jobId: id, message: "BOM uploaded and queued for processing" }; }
async function deleteOrphan(storage: ReturnType<typeof getStorage>, key: string) {
  await storage.delete(key).catch((error: unknown) => console.error(`[bom-upload] orphan cleanup failed: ${describeError(error)}`));
}

export async function bomUploadHandler(req: FastifyRequest, rfqId: string, customerId: string, userId: string) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq || rfq.customerId !== customerId) throw Errors.notFound("RFQ");
  const requestKey = z.string().uuid().optional().parse(req.headers["idempotency-key"]);
  const file = await readBomFile(req);
  const contentSha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  // Legacy clients have no header: identical bytes in one RFQ remain retry-safe.
  const uploadKey = `${rfqId}:${requestKey?.toLowerCase() ?? `sha256:${contentSha256}`}`;
  const previous = await prisma.document.findUnique({ where: { uploadKey } });
  if (previous && previous.contentSha256 !== contentSha256) throw Errors.conflict("Idempotency key was already used for a different BOM file");
  if (previous && ["COMPLETED", "PROCESSING"].includes(previous.processingStatus)) return result(previous.id);
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("BOM can only be uploaded to DRAFT RFQs");

  const storage = getStorage();
  const candidateKey = previous ? null : `bom/${customerId}/${rfqId}/${crypto.randomUUID()}${file.ext}`;
  // Compensate failed writes/transactions and race losers. Queue failure occurs
  // after commit and must retain the original file/document for recovery.
  let created = false;
  let doc;
  try {
    if (candidateKey) await storage.put(candidateKey, file.buffer, file.mime);
    doc = await prisma.$transaction(async (tx) => {
      const owners = await tx.$queryRaw<Array<{ status: string; customerId: string }>>`
        SELECT status, customer_id AS "customerId" FROM rfqs WHERE id = ${rfqId}::uuid FOR UPDATE
      `;
      const owner = owners[0];
      if (!owner || owner.customerId !== customerId) throw Errors.notFound("RFQ");
      const existing = await tx.document.findUnique({ where: { uploadKey } });
      if (existing && existing.contentSha256 !== contentSha256) throw Errors.conflict("Idempotency key was already used for a different BOM file");
      if (existing && ["COMPLETED", "PROCESSING"].includes(existing.processingStatus)) return existing;
      if (owner.status !== "DRAFT") throw Errors.unprocessable("BOM can only be uploaded to DRAFT RFQs");
      if (existing) {
        if (existing.processingStatus === "FAILED") return tx.document.update({ where: { id: existing.id }, data: { processingStatus: "UPLOADED", processingError: null } });
        return existing;
      }
      if (!candidateKey) throw Errors.internal();
      const document = await tx.document.create({ data: {
        customerId, rfqId, documentType: "BOM", fileName: file.filename,
        storageKey: candidateKey, mimeType: file.mime, fileSizeBytes: file.buffer.length,
        processingStatus: "UPLOADED", uploadedById: userId, uploadKey, contentSha256,
      } });
      await auditInTx(tx, { userId, customerId, action: "bom.uploaded", entityType: "rfq", entityId: rfqId, ipAddress: req.ip, userAgent: req.headers["user-agent"] });
      return document;
    });
    created = doc.storageKey === candidateKey;
  } catch (error) {
    if (candidateKey) await deleteOrphan(storage, candidateKey);
    throw error;
  }
  if (candidateKey && !created) await deleteOrphan(storage, candidateKey);
  if (doc.processingStatus === "UPLOADED") await enqueueBomJob(doc.id, { documentId: doc.id, rfqId, customerId });
  return result(doc.id);
}
