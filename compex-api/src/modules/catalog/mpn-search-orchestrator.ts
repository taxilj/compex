import { withTimeout, TimeoutError } from "../../lib/async.js";
import { cacheGet, cacheSet } from "../../lib/cache.js";
import { createMouserFetcher } from "../catalog-import/fetchers/mouser-fetcher.js";
import { createDigiKeyFetcher } from "../catalog-import/fetchers/digikey-fetcher.js";
import { createElement14Fetcher } from "../catalog-import/fetchers/element14-fetcher.js";
import { isNexarConfigured } from "../catalog-import/fetchers/nexar-client.js";
import type { RawCatalogItem } from "../catalog-import/types.js";
import { env } from "../../config/env.js";
import {
  normalizePublicMpn,
  lookupPublicProduct,
  type PublicProduct,
} from "./public-product-lookup.js";

// Multi-supplier exact-MPN search orchestrator (COMPEX multi-supplier live
// search feature). Mouser / DigiKey / element14 run in parallel as PRIMARY
// sources; Nexar Supply is FALLBACK ONLY, and only when all three primaries
// come back with a confirmed NO_MATCH. A primary provider that errors,
// times out, or is rate-limited is explicitly NOT the same thing as
// "no result" and must never trigger the Nexar fallback -- see
// shouldFallbackToNexar() below.

export type PrimaryProviderName = "MOUSER" | "DIGIKEY" | "ELEMENT14";
export type ProviderName = PrimaryProviderName | "NEXAR";
export type ProviderResultStatus = "FOUND" | "NO_MATCH" | "ERROR" | "TIMEOUT" | "RATE_LIMITED";

export interface ProviderStatusEntry {
  provider: ProviderName;
  status: ProviderResultStatus;
}

export interface MpnSearchResult {
  product: PublicProduct | null;
  sources: ProviderStatusEntry[];
}

// Independent per-provider timeout (Phase 3): 3-5s range, one slow provider
// must never hold up the others (Promise.allSettled below already isolates
// failures; this bounds latency too).
const PRIMARY_TIMEOUT_MS = 4_000;

// Cache TTLs (Phase 7): product facts are long-lived, provider
// presence/status is short-lived so a transient failure/rate-limit is
// retried again soon rather than being remembered for a day.
const PRODUCT_CACHE_NAMESPACE = "public-mpn-search-product";
const STATUS_CACHE_NAMESPACE = "public-mpn-search-status";
const PRODUCT_CACHE_TTL_SECONDS = 24 * 60 * 60;
const STATUS_CACHE_TTL_SECONDS = 10 * 60;

interface PrimaryOutcome {
  provider: PrimaryProviderName;
  status: ProviderResultStatus;
  item?: RawCatalogItem;
}

function classifyThrown(err: unknown): ProviderResultStatus {
  if (err instanceof TimeoutError) return "TIMEOUT";
  const code = (err as { code?: string } | undefined)?.code;
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  return "ERROR";
}

function createPrimaryFetcher(provider: PrimaryProviderName, mpn: string) {
  if (provider === "MOUSER") return createMouserFetcher(mpn);
  if (provider === "DIGIKEY") return createDigiKeyFetcher(mpn);
  return createElement14Fetcher(mpn);
}

async function runPrimary(provider: PrimaryProviderName, mpn: string): Promise<PrimaryOutcome> {
  try {
    const fetcher = createPrimaryFetcher(provider, mpn);
    const { items } = await withTimeout(fetcher.fetch(), PRIMARY_TIMEOUT_MS, `${provider} MPN lookup`);
    const item = items.find((candidate) => candidate.mpn.length > 0);
    return item ? { provider, status: "FOUND", item } : { provider, status: "NO_MATCH" };
  } catch (err) {
    return { provider, status: classifyThrown(err) };
  }
}

// Same normalization the rest of the catalog-import pipeline uses for
// manufacturer names (see catalog-import/normalizer.ts's slugify), kept
// local so this module has no write-path dependency.
function normalizeManufacturerKey(value: string | undefined): string {
  return (value ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Canonical identity for this ephemeral (non-persisted) public search is the
// same rule as the DB layer: normalized MPN + normalized manufacturer.
// Items that agree on manufacturer are merged; an item whose manufacturer
// conflicts with the group is never silently folded in (Phase 5) -- it is
// dropped from the merge (its FOUND status is still reported in `sources`).
function selectCanonicalGroup(items: RawCatalogItem[]): RawCatalogItem[] {
  const groups = new Map<string, RawCatalogItem[]>();
  const unknown: RawCatalogItem[] = [];
  for (const item of items) {
    const key = normalizeManufacturerKey(item.manufacturer);
    if (!key) {
      unknown.push(item);
      continue;
    }
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  if (groups.size === 0) return unknown;
  // Prefer the largest known-manufacturer group (most providers agree).
  const [canonicalKey] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  return [...groups.get(canonicalKey)!, ...unknown];
}

function longerText(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

// Merge facts from multiple providers into one canonical RawCatalogItem.
// Never overwrites a good existing value with null/empty (Phase 5).
export function mergeRawCatalogItems(rawItems: RawCatalogItem[]): RawCatalogItem | null {
  const items = selectCanonicalGroup(rawItems);
  if (items.length === 0) return null;

  const merged: RawCatalogItem = { mpn: items[0].mpn };
  for (const item of items) {
    merged.manufacturer = merged.manufacturer ?? item.manufacturer;
    merged.name = merged.name ?? item.name;
    merged.description = longerText(merged.description, item.description);
    merged.category = merged.category ?? item.category;
    merged.packageType = merged.packageType ?? item.packageType;
    merged.mountingType = merged.mountingType ?? item.mountingType;
    // Prefer whichever provider actually reports a lifecycle status; the
    // first non-empty one wins, never overwritten by a later empty value.
    merged.lifecycleStatus = merged.lifecycleStatus ?? item.lifecycleStatus;
    merged.datasheetUrl = merged.datasheetUrl ?? item.datasheetUrl;
    if (!merged.images?.length && item.images?.length) merged.images = item.images;
    if (item.specifications) {
      merged.specifications = { ...item.specifications, ...(merged.specifications ?? {}) };
    }
  }
  return merged;
}

function specEntries(specifications: Record<string, unknown> | undefined): Array<{ name: string; value: string }> {
  return Object.entries(specifications ?? {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0)
    .map(([name, value]) => ({ name, value: String(value) }));
}

function isComplianceSpecName(name: string): boolean {
  return /rohs|reach|compliance|conflict mineral/i.test(name);
}

// Same public-safe shape as public-product-lookup.ts's mapNexarPublicProduct
// -- deliberately facts-only, never sourceUrl/sourceProductId/internalOffers.
export function mapRawItemToPublicProduct(item: RawCatalogItem): PublicProduct {
  const specifications = specEntries(item.specifications);
  const compliance = specifications.filter((spec) => isComplianceSpecName(spec.name)).map((spec) => spec.value);

  return {
    mpn: item.mpn,
    manufacturer: item.manufacturer?.trim() || "Unknown manufacturer",
    productName: item.name?.trim() || item.description?.trim() || item.mpn,
    description: item.description,
    category: item.category,
    imageUrl: item.images?.[0],
    datasheetUrl: item.datasheetUrl,
    lifecycleStatus: item.lifecycleStatus,
    ...(compliance.length ? { compliance: [...new Set(compliance)] } : {}),
    specifications,
  };
}

export function anyPrimaryOrFallbackConfigured(): boolean {
  return Boolean(env.MOUSER_API_KEY || (env.DIGIKEY_CLIENT_ID && env.DIGIKEY_CLIENT_SECRET) || env.ELEMENT14_API_KEY || isNexarConfigured());
}

export async function searchMpnAcrossProviders(input: string): Promise<MpnSearchResult> {
  const mpn = normalizePublicMpn(input);

  const cachedProduct = await cacheGet<PublicProduct | null>(PRODUCT_CACHE_NAMESPACE, mpn);
  if (cachedProduct) {
    const cachedStatus = await cacheGet<ProviderStatusEntry[]>(STATUS_CACHE_NAMESPACE, mpn);
    return { product: cachedProduct.value, sources: cachedStatus?.value ?? [] };
  }

  const settled = await Promise.allSettled([
    runPrimary("MOUSER", mpn),
    runPrimary("DIGIKEY", mpn),
    runPrimary("ELEMENT14", mpn),
  ]);
  // runPrimary never rejects (it catches internally) -- allSettled is used
  // defensively so one truly unexpected throw can never sink the others.
  const providers: PrimaryProviderName[] = ["MOUSER", "DIGIKEY", "ELEMENT14"];
  const outcomes: PrimaryOutcome[] = settled.map((result, index) =>
    result.status === "fulfilled" ? result.value : { provider: providers[index], status: "ERROR" },
  );

  const sources: ProviderStatusEntry[] = outcomes.map(({ provider, status }) => ({ provider, status }));
  const foundItems = outcomes.filter((o): o is PrimaryOutcome & { item: RawCatalogItem } => o.status === "FOUND" && Boolean(o.item)).map((o) => o.item);
  // Fallback rule (Phase 3): Nexar runs ONLY when every primary is a
  // confirmed NO_MATCH. Any ERROR/TIMEOUT/RATE_LIMITED on any primary blocks
  // the fallback, even if the other two are NO_MATCH.
  const allPrimariesConfirmedNoMatch = outcomes.every((o) => o.status === "NO_MATCH");

  let product: PublicProduct | null = null;

  if (foundItems.length > 0) {
    const merged = mergeRawCatalogItems(foundItems);
    product = merged ? mapRawItemToPublicProduct(merged) : null;
  } else if (allPrimariesConfirmedNoMatch) {
    try {
      const nexarProduct = await lookupPublicProduct(mpn);
      sources.push({ provider: "NEXAR", status: nexarProduct ? "FOUND" : "NO_MATCH" });
      product = nexarProduct;
    } catch (err) {
      sources.push({ provider: "NEXAR", status: classifyThrown(err) });
    }
  }
  // Otherwise: a mix of NO_MATCH and ERROR/TIMEOUT/RATE_LIMITED with nothing
  // FOUND. Nexar must not run; product stays null and `sources` carries the
  // per-provider detail so the UI can show a non-blocking partial-failure
  // notice instead of a false "this part doesn't exist".

  // A definitive answer (something found, or every source that actually
  // resolved says NO_MATCH) is safe to cache as product facts. A provider
  // failure must never poison the cache with a false "not found".
  const nexarEntry = sources.find((s) => s.provider === "NEXAR");
  const definitiveNoResult = allPrimariesConfirmedNoMatch && (!nexarEntry || nexarEntry.status === "NO_MATCH");
  const definitive = foundItems.length > 0 || definitiveNoResult;

  if (definitive) {
    await cacheSet(PRODUCT_CACHE_NAMESPACE, mpn, product, PRODUCT_CACHE_TTL_SECONDS);
  }
  await cacheSet(STATUS_CACHE_NAMESPACE, mpn, sources, STATUS_CACHE_TTL_SECONDS);

  return { product, sources };
}
