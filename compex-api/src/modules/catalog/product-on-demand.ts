import { prisma } from "../../lib/prisma.js";
import { withTimeout, TimeoutError } from "../../lib/async.js";
import { incrementCounter } from "../../lib/cache.js";
import { env } from "../../config/env.js";
import { normalizeMpn } from "../catalog-import/normalizer.js";
import { runImport } from "../catalog-import/run-import.js";
import { createMouserFetcher } from "../catalog-import/fetchers/mouser-fetcher.js";
import { createElement14Fetcher } from "../catalog-import/fetchers/element14-fetcher.js";
import { createDigiKeyFetcher } from "../catalog-import/fetchers/digikey-fetcher.js";
import type { CatalogFetcher } from "../catalog-import/types.js";
import { PRODUCT_INCLUDE } from "./product-search.js";
import { toPublicProduct } from "./public-dto.js";

export type OnDemandProviderName = "MOUSER" | "DIGIKEY" | "ELEMENT14";
export type OnDemandProviderStatus = "FOUND" | "NO_MATCH" | "ERROR" | "TIMEOUT" | "RATE_LIMITED";

export interface OnDemandProviderEntry {
  provider: OnDemandProviderName;
  status: OnDemandProviderStatus;
}

export interface OnDemandResult {
  product: ReturnType<typeof toPublicProduct> | null;
  sources: OnDemandProviderEntry[];
}

// One provider call already retries internally (run-import.ts's
// fetchWithRetry, 3 attempts with backoff) — this bounds the *total* wait
// regardless of internal retries. A provider that is still running when this
// fires is left to finish on its own (see lib/async.ts) so its result still
// lands in the database for the next visitor, even though this request stops
// waiting for it.
const ON_DEMAND_TIMEOUT_MS = 8_000;

// A shared, cross-instance ceiling on real outbound provider calls this
// endpoint can trigger per day, independent of the per-IP rate limit on the
// route itself. The per-IP limit alone doesn't bound total cost: a handful
// of rotating IPs requesting distinct never-seen MPNs could otherwise burn
// through a provider's real daily quota (Mouser's is ~1000/day per
// fetchers/mouser-fetcher.ts) in minutes, since this is a public,
// unauthenticated, unbounded-input endpoint. Kept well under the tightest
// known provider quota to leave headroom for legitimate traffic and
// STAFF/ADMIN bulk imports, which draw from the same provider accounts but
// are not counted here.
const GLOBAL_DAILY_PROVIDER_CALL_BUDGET = 300;
const COUNTER_TTL_SECONDS = 26 * 60 * 60; // a little over a day, so a slow trailing request from "today" can't reset into a fresh window mid-count

function isProviderConfigured(provider: OnDemandProviderName): boolean {
  if (provider === "MOUSER") return Boolean(env.MOUSER_API_KEY);
  if (provider === "DIGIKEY") return Boolean(env.DIGIKEY_CLIENT_ID && env.DIGIKEY_CLIENT_SECRET);
  return Boolean(env.ELEMENT14_API_KEY);
}

async function findInDb(mpn: string, manufacturerId?: string) {
  // Match on normalizedMpn, the exact same key upsertProduct() persists and
  // matches by (see normalizer.ts) -- matching on raw mpn here would miss a
  // product that was just imported under a differently-punctuated MPN
  // spelling (e.g. "ABC-123" vs "ABC 123"), permanently defeating the fast
  // path for that variant and making resolveUnknownMpn() re-run the full
  // 3-provider fetch on every future visit.
  const where = {
    normalizedMpn: normalizeMpn(mpn),
    isActive: true,
    ...(manufacturerId ? { manufacturerId } : {}),
  };
  // A multi-manufacturer conflict (>1 match with no manufacturerId to
  // disambiguate) is the primary GET /:mpn route's concern (it returns a 409
  // there) -- on-demand resolution only ever returns a single, unambiguous
  // product or null.
  const products = await prisma.product.findMany({ where, include: PRODUCT_INCLUDE, take: 2 });
  return products.length === 1 ? products[0] : null;
}

// Reuses the exact same fetch -> validate -> normalize -> idempotent-upsert
// pipeline the STAFF/ADMIN single-MPN routes already call (run-import.ts),
// so a found item gets full CatalogImportRun audit tracking and
// dataHash-based idempotency for free -- never a second, bespoke importer.
async function importFromProvider(fetcher: CatalogFetcher): Promise<OnDemandProviderStatus> {
  const run = await prisma.catalogImportRun.create({ data: { source: fetcher.source } });
  try {
    const result = await runImport(fetcher, run.id);
    if (result.productIds.length > 0) return "FOUND";

    // A genuine "the provider had nothing" NO_MATCH carries no audit value,
    // and on a public unauthenticated endpoint it's exactly the outcome an
    // attacker gets for free by requesting fabricated MPNs -- delete the run
    // rather than let garbage input grow this table without bound. A run
    // that DID see items but rejected all of them (itemsFailed > 0) keeps
    // its record, since that's a real data-quality signal worth keeping.
    const finalRun = await prisma.catalogImportRun.findUnique({
      where: { id: run.id },
      select: { itemsProcessed: true, itemsFailed: true },
    });
    if (finalRun && finalRun.itemsProcessed === 0 && finalRun.itemsFailed === 0) {
      await prisma.catalogImportRun.delete({ where: { id: run.id } }).catch(() => {});
    }
    return "NO_MATCH";
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code;
    return code === "RATE_LIMITED" ? "RATE_LIMITED" : "ERROR";
  }
}

// In-process de-duplication: concurrent requests for the same normalized MPN
// (React StrictMode double-effect, several users cold on the same part,
// hydration re-fetch) share one in-flight resolution instead of each firing
// their own 3-provider fan-out.
const inFlight = new Map<string, Promise<OnDemandResult>>();

export async function resolveUnknownMpn(mpn: string, manufacturerId?: string): Promise<OnDemandResult> {
  const key = `${normalizeMpn(mpn)}::${manufacturerId ?? ""}`;
  const shared = inFlight.get(key);
  if (shared) return shared;

  const promise = (async (): Promise<OnDemandResult> => {
    // Race-safety: another concurrent request (or a background sync run) may
    // have already imported this MPN between the caller's initial DB miss
    // and now.
    const already = await findInDb(mpn, manufacturerId);
    if (already) return { product: toPublicProduct(already), sources: [] };

    const allProviders: Array<{ name: OnDemandProviderName; fetcher: CatalogFetcher }> = [
      { name: "MOUSER", fetcher: createMouserFetcher(mpn) },
      { name: "DIGIKEY", fetcher: createDigiKeyFetcher(mpn) },
      { name: "ELEMENT14", fetcher: createElement14Fetcher(mpn) },
    ];
    const candidates = allProviders.filter((c) => isProviderConfigured(c.name));

    if (candidates.length === 0) return { product: null, sources: [] };

    const dayKey = new Date().toISOString().slice(0, 10);
    const usedToday = await incrementCounter("on-demand-provider-calls", dayKey, COUNTER_TTL_SECONDS, candidates.length);
    if (usedToday > GLOBAL_DAILY_PROVIDER_CALL_BUDGET) {
      // Shared daily provider-call budget is exhausted -- fail honestly
      // (never silently pretend the part doesn't exist) without spending any
      // more real provider quota today.
      return { product: null, sources: candidates.map((c) => ({ provider: c.name, status: "RATE_LIMITED" as const })) };
    }

    const settled = await Promise.allSettled(
      candidates.map((c) => withTimeout(importFromProvider(c.fetcher), ON_DEMAND_TIMEOUT_MS, `${c.name} on-demand import`)),
    );

    const sources: OnDemandProviderEntry[] = settled.map((result, i) => ({
      provider: candidates[i].name,
      status: result.status === "fulfilled" ? result.value : result.reason instanceof TimeoutError ? "TIMEOUT" : "ERROR",
    }));

    const product = await findInDb(mpn, manufacturerId);
    return { product: product ? toPublicProduct(product) : null, sources };
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}
