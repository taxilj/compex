import { prisma } from "../lib/prisma.js";
import { describeError } from "../lib/safe-log.js";
import { enqueueBomJob, isBomQueueAvailable } from "../modules/documents/documents.service.js";

// A BOM whose first enqueue failed (Redis down / quota) stays UPLOADED with its
// file retained -- the "pending" state. This sweep re-enqueues those same
// documents once the queue is back, so the customer never has to re-upload.
// Re-adding is idempotent (jobId bom-<documentId>) and the worker only claims
// UPLOADED documents, so a document can never be parsed twice.
//
// Postgres is queried first: when nothing is pending this costs no Redis commands.
const POLL_INTERVAL_MS = 5 * 60_000;
const PENDING_AFTER_MS = 2 * 60_000; // give a normal upload time to be picked up first
const MAX_AGE_MS = 24 * 60 * 60_000; // older pending uploads are left for staff, never auto-processed
// Processing a BOM (read <=10 MB, parse <=20k rows, one transaction) takes seconds. A
// document still PROCESSING this long after its claim was stranded by a crash or
// redeploy. It is safe to hand back: items and COMPLETED are written in ONE transaction,
// so a PROCESSING document has no committed items, and a worker that is somehow still
// running cannot complete it any more (see the guard in bom-processor.ts).
const STALE_PROCESSING_MS = 30 * 60_000;
const BATCH_SIZE = 25;
const SUPERSEDED_REASON = "Superseded by a newer upload";
const RFQ_CLOSED_REASON = "The RFQ was submitted before this file could be processed";

export async function recoverPendingBoms(now = new Date()): Promise<number> {
  await prisma.document.updateMany({
    where: {
      documentType: "BOM",
      processingStatus: "PROCESSING",
      updatedAt: { lt: new Date(now.getTime() - STALE_PROCESSING_MS) },
      createdAt: { gt: new Date(now.getTime() - MAX_AGE_MS) },
    },
    data: { processingStatus: "UPLOADED" },
  });
  const pending = await prisma.document.findMany({
    where: {
      documentType: "BOM",
      processingStatus: "UPLOADED",
      createdAt: { lt: new Date(now.getTime() - PENDING_AFTER_MS), gt: new Date(now.getTime() - MAX_AGE_MS) },
    },
    select: { id: true, rfqId: true, leadId: true, customerId: true, createdAt: true, rfq: { select: { status: true } } },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });
  if (pending.length === 0) return 0;
  if (!(await isBomQueueAvailable())) return 0;

  let requeued = 0;
  for (const doc of pending) {
    try {
      // Uploads are only accepted while the RFQ is DRAFT. If it was submitted meanwhile (e.g. the
      // customer typed the items in after seeing the 503), appending a BOM to a submitted or
      // quoted RFQ would silently change what staff are working from: retire the document.
      if (doc.rfq && doc.rfq.status !== "DRAFT") {
        await prisma.document.updateMany({
          where: { id: doc.id, processingStatus: "UPLOADED" },
          data: { processingStatus: "FAILED", processingError: RFQ_CLOSED_REASON },
        });
        continue;
      }
      // A customer who re-uploaded after a 503 has a newer document for the same RFQ/lead:
      // re-enqueuing this older one as well would append the BOM twice. Retire it instead.
      const owner = doc.rfqId ? { rfqId: doc.rfqId } : { leadId: doc.leadId };
      const newer = await prisma.document.count({
        where: { ...owner, documentType: "BOM", createdAt: { gt: doc.createdAt }, id: { not: doc.id } },
      });
      if (newer > 0) {
        await prisma.document.updateMany({
          where: { id: doc.id, processingStatus: "UPLOADED" },
          data: { processingStatus: "FAILED", processingError: SUPERSEDED_REASON },
        });
        continue;
      }
      await enqueueBomJob(doc.id, {
        documentId: doc.id,
        rfqId: doc.rfqId ?? undefined,
        leadId: doc.leadId ?? undefined,
        customerId: doc.customerId ?? undefined,
      });
      requeued += 1;
    } catch {
      // enqueueBomJob already logged; the document simply stays pending.
    }
  }
  return requeued;
}

export function startBomRecovery(intervalMs = POLL_INTERVAL_MS) {
  let inFlight: Promise<void> | null = null;
  const tick = () => {
    if (inFlight) return inFlight; // never overlap sweeps
    inFlight = recoverPendingBoms()
      .then(() => undefined)
      .catch((err: unknown) => {
        console.error(`[bom-recovery] sweep failed: ${describeError(err)}`);
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  void tick();
  return {
    close: async () => {
      clearInterval(timer);
      await inFlight;
    },
  };
}
