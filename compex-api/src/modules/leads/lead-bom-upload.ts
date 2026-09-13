import type { FastifyRequest } from "fastify";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { audit } from "../../lib/audit.js";
import { getStorage, getBomQueue } from "../documents/documents.service.js";
import { ALLOWED_EXTS, ALLOWED_MIMES, MAX_BYTES } from "../documents/bom-upload.js";

// Safe metadata only -- never storageKey, never raw file contents.
const LEAD_DOCUMENT_SELECT = {
  id: true,
  fileName: true,
  processingStatus: true,
  processingError: true,
  fileSizeBytes: true,
  createdAt: true,
} as const;

async function assertBomLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, source: true } });
  // 404 either way -- never confirm whether a given UUID exists but is the
  // wrong source, same "don't leak resource existence" convention as
  // documents.service.ts's ownership check.
  if (!lead || lead.source !== "BOM") throw Errors.notFound("Lead");
  return lead;
}

function toResult(doc: { id: string; fileName: string; processingStatus: string; processingError: string | null; fileSizeBytes: number }, duplicate: boolean) {
  return {
    documentId: doc.id,
    fileName: doc.fileName,
    processingStatus: doc.processingStatus,
    processingError: doc.processingError,
    fileSizeBytes: doc.fileSizeBytes,
    duplicate,
  };
}

async function deleteOrphan(storage: ReturnType<typeof getStorage>, key: string) {
  await storage.delete(key).catch((cleanupErr) =>
    console.error("[lead-bom-upload] orphan cleanup failed:", cleanupErr instanceof Error ? cleanupErr.message : "Unknown error"),
  );
}

export async function leadBomUploadHandler(req: FastifyRequest, leadId: string) {
  await assertBomLead(leadId);

  // Always drain the multipart stream before branching, so an idempotent
  // duplicate-upload response never leaves the request body unconsumed.
  const data = await req.file();
  if (!data) throw Errors.validation("No file uploaded");
  const buffer = await data.toBuffer();

  // Idempotent: a lead accepts exactly one *in-flight or successful* BOM
  // document. A retry (network blip, duplicate click) must not create a
  // second document -- return the existing one's current status instead of
  // storing a second file. But a FAILED document must not permanently block
  // re-upload: the customer needs to be able to fix their file and try
  // again, so a fresh upload after a failure creates a new document rather
  // than replaying the same failure forever. This is only a fast pre-check
  // (cheap, avoids a wasted storage write for the common retry case) -- the
  // authoritative check happens under an advisory lock below, since two
  // concurrent requests could otherwise both pass this check and both
  // create a document + enqueue a processing job for the same lead.
  const preCheck = await prisma.document.findFirst({
    where: { leadId },
    select: LEAD_DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
  });
  if (preCheck && preCheck.processingStatus !== "FAILED") {
    return toResult(preCheck, true);
  }

  const ext = path.extname(data.filename).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    throw Errors.validation("Only .xlsx and .csv files are allowed");
  }

  const mime = data.mimetype.split(";")[0].trim();
  if (!ALLOWED_MIMES.has(mime) && mime !== "application/octet-stream") {
    throw Errors.validation("Invalid file type");
  }

  if (buffer.length > MAX_BYTES) {
    throw Errors.validation("File exceeds 10 MB limit");
  }

  // Basic file signature check for XLSX (PK zip magic bytes) -- same check
  // used by the authenticated portal upload.
  if (ext === ".xlsx" && (buffer[0] !== 0x50 || buffer[1] !== 0x4b)) {
    throw Errors.validation("File does not appear to be a valid XLSX file");
  }

  const key = `bom/leads/${leadId}/${crypto.randomUUID()}${ext}`;
  const storage = getStorage();
  await storage.put(key, buffer, mime);

  // Re-check-and-create under a Postgres advisory lock scoped to this lead,
  // mirroring lead-line-number.ts. This serializes concurrent uploads for
  // the same lead so at most one can win: the loser's storage write is
  // cleaned up below rather than left as an orphan, and only the winner
  // enqueues a processing job -- closing the race that would otherwise let
  // two concurrent requests both create a document and double the lead's
  // parsed line items.
  let doc;
  let raceLoserResult: ReturnType<typeof toResult> | null = null;
  try {
    doc = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`compex-lead-bom:${leadId}`}))`;
      const existing = await tx.document.findFirst({
        where: { leadId },
        select: LEAD_DOCUMENT_SELECT,
        orderBy: { createdAt: "desc" },
      });
      if (existing && existing.processingStatus !== "FAILED") {
        raceLoserResult = toResult(existing, true);
        return null;
      }
      return tx.document.create({
        data: {
          leadId,
          documentType: "BOM",
          fileName: data.filename,
          storageKey: key,
          mimeType: mime,
          fileSizeBytes: buffer.length,
          processingStatus: "UPLOADED",
        },
        select: LEAD_DOCUMENT_SELECT,
      });
    });
  } catch (err) {
    // Storage succeeded but the DB transaction failed -- delete the
    // now-orphaned object rather than leaving an untracked file in the
    // bucket forever.
    await deleteOrphan(storage, key);
    throw err;
  }

  if (raceLoserResult) {
    await deleteOrphan(storage, key);
    return raceLoserResult;
  }

  audit({ action: "lead_bom.uploaded", entityType: "lead", entityId: leadId, ipAddress: req.ip, userAgent: req.headers["user-agent"] });

  // Enqueue async processing. The file is already stored and the Document
  // row already created, so a queue failure here must not hang the request
  // indefinitely: fail fast with a clear 503 instead.
  try {
    const queue = getBomQueue();
    await queue.add("parse-bom", { documentId: doc!.id, leadId });
  } catch {
    throw Errors.serviceUnavailable(
      "BOM upload was saved but processing is temporarily unavailable. Please try again shortly.",
    );
  }

  return toResult(doc!, false);
}

export async function getLeadBomStatus(leadId: string) {
  await assertBomLead(leadId);

  const doc = await prisma.document.findFirst({
    where: { leadId },
    select: LEAD_DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
  });
  if (!doc) throw Errors.notFound("Document");

  // Only surface a count once parsing has actually completed -- never claim
  // a line-item number while still processing or after a failure.
  const validItemCount = doc.processingStatus === "COMPLETED"
    ? await prisma.leadItem.count({ where: { leadId } })
    : undefined;

  return {
    documentId: doc.id,
    fileName: doc.fileName,
    processingStatus: doc.processingStatus,
    processingError: doc.processingError,
    fileSizeBytes: doc.fileSizeBytes,
    validItemCount,
  };
}
