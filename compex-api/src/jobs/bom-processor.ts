import { Worker } from "bullmq";
import IORedis from "ioredis";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma.js";
import { getStorage } from "../modules/documents/documents.service.js";
import { env } from "../config/env.js";
import { Decimal } from "@prisma/client/runtime/library";
import { nextRfqItemLineNumber } from "../modules/rfqs/rfq-line-number.js";

// XLSX safety: disable formula evaluation, no macro execution
const XLSX_READ_OPTS: XLSX.ParsingOptions = {
  cellFormula: false,
  cellHTML: false,
  cellDates: true,
  password: "",
};

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
  "part#": "mpn",
  mfr: "manufacturer",
  manufacturer: "manufacturer",
  mfgr: "manufacturer",
  desc: "description",
  description: "description",
  qty: "quantity",
  quantity: "quantity",
  targetprice: "targetPriceUsd",
  targetpriceusd: "targetPriceUsd",
  unitprice: "targetPriceUsd",
};

function parseRows(buffer: Buffer, ext: string): BomRow[] {
  if (ext === ".csv") {
    const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
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

  const wb = XLSX.read(buffer, XLSX_READ_OPTS);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
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
      const { documentId, rfqId } = job.data as { documentId: string; rfqId: string };

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
        if (validRows.length === 0) throw new Error("No valid rows found in BOM (mpn + quantity required)");

        await prisma.$transaction(async (tx) => {
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
          await tx.document.update({
            where: { id: documentId },
            data: { processingStatus: "COMPLETED" },
          });
        });
      } catch (err) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            processingStatus: "FAILED",
            processingError: err instanceof Error ? err.message : "Unknown error",
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
