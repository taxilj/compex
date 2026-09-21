import { Worker } from "bullmq";
import IORedis from "ioredis";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma.js";
import { getStorage } from "../modules/documents/documents.service.js";
import { env } from "../config/env.js";
import { Decimal } from "@prisma/client/runtime/library";
import { nextRfqItemLineNumber } from "../modules/rfqs/rfq-line-number.js";
import { nextLeadItemLineNumber } from "../modules/leads/lead-line-number.js";
import { readFirstSheetSafely, UnsafeWorkbookError } from "../lib/xlsx-safe.js";

// Marks a message as safe to show to the (possibly anonymous, unauthenticated)
// caller of GET /leads/:leadId/bom. Everything else -- Prisma errors, raw
// filesystem paths from LocalStorageProvider, S3 SDK errors -- must never
// reach that public response; only ever logged server-side.
class BomValidationError extends Error {}

const MAX_CSV_ROWS = 20_000;

interface BomRow {
  mpn?: string;
  manufacturer?: string;
  description?: string;
  quantity?: number;
  targetPriceUsd?: number;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, "");
}

// Map common BOM column name variations → canonical keys
const HEADER_MAP: Record<string, keyof BomRow> = {
  mpn: "mpn",
  partnumber: "mpn",
  partno: "mpn",
  rfqpartno: "mpn",
  "part#": "mpn",
  mfr: "manufacturer",
  make: "manufacturer",
  manufacturer: "manufacturer",
  mfgr: "manufacturer",
  desc: "description",
  description: "description",
  qty: "quantity",
  quantity: "quantity",
  tp: "targetPriceUsd",
  targetprice: "targetPriceUsd",
  targetpriceusd: "targetPriceUsd",
  unitprice: "targetPriceUsd",
};

function parseRows(buffer: Buffer, ext: string): BomRow[] {
  if (ext === ".csv") {
    // to_line bounds parsing cost for an oversized CSV: stop reading one row
    // past the cap (+1 for the header line) so an overflow is detectable
    // without ever materializing the full row set in memory.
    const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, to_line: MAX_CSV_ROWS + 2 });
    if (records.length > MAX_CSV_ROWS) {
      throw new BomValidationError(`CSV exceeds the maximum of ${MAX_CSV_ROWS} rows`);
    }
    return records.map((row: Record<string, string>) => {
      const normalized: BomRow = {};
      for (const [k, v] of Object.entries(row)) {
        const key = HEADER_MAP[normalizeHeader(k)];
        if (key === "quantity") normalized.quantity = parseInt(v, 10) || undefined;
        else if (key === "targetPriceUsd") normalized.targetPriceUsd = parseFloat(v) || undefined;
        else if (key) (normalized as Record<string, unknown>)[key] = v || undefined;
      }
      return normalized;
    });
  }

  const raw = readFirstSheetSafely(buffer);
  return raw.map((row) => {
    const normalized: BomRow = {};
    for (const [k, v] of Object.entries(row)) {
      const key = HEADER_MAP[normalizeHeader(String(k))];
      if (key === "quantity") normalized.quantity = parseInt(String(v), 10) || undefined;
      else if (key === "targetPriceUsd") normalized.targetPriceUsd = parseFloat(String(v)) || undefined;
      else if (key) (normalized as Record<string, unknown>)[key] = String(v) || undefined;
    }
    return normalized;
  });
}

export function startBomWorker() {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker(
    "bom-processing",
    async (job) => {
      const { documentId, rfqId, leadId } = job.data as { documentId: string; rfqId?: string; leadId?: string };

      // Claim only an unprocessed upload. A duplicate BullMQ delivery must not
      // parse and append the same BOM twice.
      const claimed = await prisma.document.updateMany({
        where: { id: documentId, processingStatus: "UPLOADED" },
        data: { processingStatus: "PROCESSING" },
      });
      if (claimed.count !== 1) return;

      const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

      try {
        const storage = getStorage();
        const buffer = await storage.readFile(doc.storageKey);

        const ext = doc.storageKey.endsWith(".csv") ? ".csv" : ".xlsx";
        const rows = parseRows(buffer, ext);

        const validRows = rows.filter((r) => r.mpn && r.quantity && r.quantity > 0);
        if (validRows.length === 0) throw new BomValidationError("No valid rows found in BOM (mpn + quantity required)");

        await prisma.$transaction(async (tx) => {
          if (rfqId) {
            const firstLineNumber = await nextRfqItemLineNumber(tx, rfqId);
            await tx.rfqItem.createMany({
              data: validRows.map((row, i) => ({
                rfqId,
                lineNumber: firstLineNumber + i,
                mpn: row.mpn!,
                manufacturer: row.manufacturer,
                description: row.description,
                quantity: row.quantity!,
                targetPriceUsd: row.targetPriceUsd != null ? new Decimal(row.targetPriceUsd) : undefined,
              })),
            });
          } else if (leadId) {
            // Public website BOM enquiry: same parsing/validation, appended
            // to the lead's own item list instead of an RFQ's. No pricing
            // field on LeadItem -- targetPriceUsd is simply not carried over,
            // matching the public enquiry form's existing manual-entry shape.
            const firstLineNumber = await nextLeadItemLineNumber(tx, leadId);
            await tx.leadItem.createMany({
              data: validRows.map((row, i) => ({
                leadId,
                lineNumber: firstLineNumber + i,
                mpn: row.mpn!,
                manufacturer: row.manufacturer,
                description: row.description,
                quantity: row.quantity!,
              })),
            });
          } else {
            throw new Error("BOM processing job is missing both rfqId and leadId");
          }
          await tx.document.update({
            where: { id: documentId },
            data: { processingStatus: "COMPLETED" },
          });
        });
      } catch (err) {
        // Only ever surface messages from known-safe error types to the
        // public status endpoint -- everything else (Prisma errors, local
        // filesystem paths, S3 SDK errors) is real internal detail that must
        // never reach an anonymous, unauthenticated caller.
        const isSafeToShow = err instanceof BomValidationError || err instanceof UnsafeWorkbookError;
        if (!isSafeToShow) {
          console.error(`[bom-worker] document ${documentId} processing failed:`, err instanceof Error ? err.message : "Unknown error");
        }
        await prisma.document.update({
          where: { id: documentId },
          data: {
            processingStatus: "FAILED",
            processingError: isSafeToShow ? (err as Error).message : "The BOM file could not be processed. Please check the file and try again.",
          },
        });
        throw err;
      }
    },
    { connection, concurrency: 3 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[bom-worker] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
