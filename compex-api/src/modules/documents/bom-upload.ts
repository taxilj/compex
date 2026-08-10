import type { FastifyRequest } from "fastify";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { audit } from "../../lib/audit.js";
import { getStorage } from "./documents.service.js";
import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import IORedis from "ioredis";

const ALLOWED_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/plain",
]);
const ALLOWED_EXTS = new Set([".xlsx", ".csv"]);
const MAX_BYTES = 10 * 1024 * 1024;

let bomQueue: Queue | null = null;

function getQueue(): Queue {
  if (!bomQueue) {
    const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    bomQueue = new Queue("bom-processing", { connection });
  }
  return bomQueue;
}

export async function bomUploadHandler(
  req: FastifyRequest,
  rfqId: string,
  customerId: string,
  userId: string,
) {
  // Verify RFQ ownership before accepting upload
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq || rfq.customerId !== customerId) throw Errors.notFound("RFQ");
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("BOM can only be uploaded to DRAFT RFQs");

  const data = await req.file();
  if (!data) throw Errors.validation("No file uploaded");

  const ext = path.extname(data.filename).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    throw Errors.validation("Only .xlsx and .csv files are allowed");
  }

  // Check MIME — both extension and MIME must agree
  const mime = data.mimetype.split(";")[0].trim();
  if (!ALLOWED_MIMES.has(mime) && mime !== "application/octet-stream") {
    throw Errors.validation("Invalid file type");
  }

  const buffer = await data.toBuffer();
  if (buffer.length > MAX_BYTES) {
    throw Errors.validation("File exceeds 10 MB limit");
  }

  // Basic file signature check for XLSX (PK zip magic bytes)
  if (ext === ".xlsx" && buffer[0] !== 0x50 && buffer[1] !== 0x4b) {
    throw Errors.validation("File does not appear to be a valid XLSX file");
  }

  const key = `bom/${customerId}/${rfqId}/${crypto.randomUUID()}${ext}`;
  const storage = getStorage();
  await storage.put(key, buffer, mime);

  const doc = await prisma.document.create({
    data: {
      customerId,
      rfqId,
      documentType: "BOM",
      fileName: data.filename,
      storageKey: key,
      mimeType: mime,
      fileSizeBytes: buffer.length,
      processingStatus: "UPLOADED",
      uploadedById: userId,
    },
  });

  audit({ userId, customerId, action: "bom.uploaded", entityType: "rfq", entityId: rfqId });

  // Enqueue async processing job
  const queue = getQueue();
  await queue.add("parse-bom", { documentId: doc.id, rfqId, customerId });

  return { jobId: doc.id, message: "BOM uploaded and queued for processing" };
}