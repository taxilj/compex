import { prisma } from "../../lib/prisma.js";
import { RawCatalogItemSchema } from "./validator.js";
import { normalizeItem } from "./normalizer.js";
import { upsertProduct } from "./upsert.js";
import type { CatalogFetcher } from "./types.js";

const PAGE_DELAY_MS = 200; // ponytail: flat delay between pages, upgrade to a token-bucket limiter if a source needs per-second caps
const MAX_FETCH_RETRIES = 3;

export interface CatalogImportResult {
  // The route layer uses these IDs rather than re-querying only by MPN. An
  // MPN is no longer globally unique once canonical matching is manufacturer
  // aware, so an MPN-only lookup could return a different manufacturer's row.
  productIds: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(fetcher: CatalogFetcher, cursor: string | undefined) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetcher.fetch(cursor);
    } catch (err) {
      if (attempt >= MAX_FETCH_RETRIES) throw err;
      await sleep(2 ** attempt * 200);
    }
  }
}

// The generic import loop: fetch → validate → normalize → dedupe(hash-skip)
// → upsert, persisting cursor + counters after every page so a crashed run
// resumes from its last completed page instead of restarting.
export async function runImport(fetcher: CatalogFetcher, runId: string): Promise<CatalogImportResult> {
  let cursor: string | undefined;
  let itemsProcessed = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let itemsFailed = 0;
  const errors: Array<{ mpn?: string; message: string }> = [];
  const productIds = new Set<string>();

  try {
    do {
      const page = await fetchWithRetry(fetcher, cursor);

      for (const raw of page.items) {
        itemsProcessed++;
        const parsed = RawCatalogItemSchema.safeParse(raw);
        if (!parsed.success) {
          itemsFailed++;
          errors.push({ mpn: raw.mpn, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          continue;
        }
        try {
          const normalized = await normalizeItem(parsed.data, fetcher.source);
          const result = await upsertProduct(normalized, fetcher.source);
          productIds.add(result.productId);
          if (result.outcome === "created") itemsCreated++;
          else if (result.outcome === "updated") itemsUpdated++;
        } catch (err) {
          itemsFailed++;
          errors.push({ mpn: parsed.data.mpn, message: err instanceof Error ? err.message : "Upsert failed" });
        }
      }

      cursor = page.nextCursor;
      await prisma.catalogImportRun.update({
        where: { id: runId },
        data: { cursor, itemsProcessed, itemsCreated, itemsUpdated, itemsFailed, errorLog: errors.length ? errors : undefined },
      });

      if (cursor) await sleep(PAGE_DELAY_MS);
    } while (cursor);

    await prisma.catalogImportRun.update({ where: { id: runId }, data: { status: "COMPLETED", completedAt: new Date() } });
    return { productIds: [...productIds] };
  } catch (err) {
    await prisma.catalogImportRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorLog: [...errors, { message: err instanceof Error ? err.message : "Import failed" }],
      },
    });
    throw err;
  }
}
