import { env } from "../../../config/env.js";
import { Errors } from "../../../lib/errors.js";
import type { CatalogFetcher, RawCatalogItem } from "../types.js";
import { normalizeMpn } from "../normalizer.js";

// Mouser Search API — official docs: https://api.mouser.com/api/docs/ui/index
// License: "Mouser Electronics grants a limited... license to copy and
// display Mouser Electronics Data solely on your Application"
// (https://www.mouser.com/en/apiterms/) — covers exactly this use (showing
// the data in COMPEX's own catalog). Rate-limit guideline: ~30 req/min,
// 1000/day; a single-MPN lookup is far under that, and the existing
// run-import.ts loop already retries with backoff around fetch().
const MOUSER_PARTNUMBER_SEARCH_URL = "https://api.mouser.com/api/v2/search/partnumber";

interface MouserProductAttribute {
  AttributeName?: string;
  AttributeValue?: string;
}

export interface MouserPart {
  Manufacturer?: string;
  ManufacturerPartNumber?: string;
  MouserPartNumber?: string;
  Description?: string;
  Category?: string;
  DataSheetUrl?: string;
  ImagePath?: string;
  ProductDetailUrl?: string;
  LifecycleStatus?: string;
  ROHSStatus?: string;
  ProductAttributes?: MouserProductAttribute[];
}

interface MouserSearchResponse {
  Errors?: Array<{ Id?: string; Code?: string; Message?: string; PropertyName?: string }>;
  SearchResults?: { NumberOfResult?: number; Parts?: MouserPart[] };
}

export function mapPart(part: MouserPart): RawCatalogItem {
  const specifications: Record<string, unknown> = {};
  for (const attr of part.ProductAttributes ?? []) {
    if (attr.AttributeName && attr.AttributeValue) specifications[attr.AttributeName] = attr.AttributeValue;
  }
  if (part.ROHSStatus) specifications.rohsStatus = part.ROHSStatus;

  const packageType = (() => {
    const key = Object.keys(specifications).find((k) => /package|case/i.test(k));
    return key ? String(specifications[key]) : undefined;
  })();

  return {
    mpn: part.ManufacturerPartNumber?.trim() || "",
    manufacturer: part.Manufacturer,
    description: part.Description,
    category: part.Category,
    packageType,
    lifecycleStatus: part.LifecycleStatus,
    datasheetUrl: part.DataSheetUrl,
    sourceProductId: part.MouserPartNumber,
    sourceUrl: part.ProductDetailUrl,
    images: part.ImagePath ? [part.ImagePath] : undefined,
    specifications: Object.keys(specifications).length ? specifications : undefined,
  };
}

// Single-MPN lookup (Phase 2 step 8) — one page, at most one item. Reuses
// run-import.ts for retry/rate-limit/idempotency/CatalogImportRun tracking
// exactly like the CSV fetcher, rather than a bespoke one-off script.
export function createMouserFetcher(mpn: string): CatalogFetcher {
  return {
    source: "MOUSER",
    async fetch(): Promise<{ items: RawCatalogItem[] }> {
      if (!env.MOUSER_API_KEY) {
        throw Errors.serviceUnavailable(
          "MOUSER_API_KEY is not configured. Get a free Search API key at https://www.mouser.com/api-hub/ and set it in the server environment.",
        );
      }

      const res = await fetch(`${MOUSER_PARTNUMBER_SEARCH_URL}?apiKey=${encodeURIComponent(env.MOUSER_API_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ SearchByPartRequest: { mouserPartNumber: mpn, partSearchOptions: "" } }),
      });

      if (res.status === 429) {
        throw Errors.rateLimited();
      }
      if (!res.ok) {
        throw Errors.serviceUnavailable(`Mouser API request failed with status ${res.status}`);
      }

      const body = (await res.json()) as MouserSearchResponse;
      if (body.Errors && body.Errors.length > 0) {
        throw Errors.serviceUnavailable(`Mouser API error: ${body.Errors.map((e) => e.Message).join("; ")}`);
      }

      const parts = body.SearchResults?.Parts ?? [];
      const requestedMpn = normalizeMpn(mpn);
      const items = parts
        .map(mapPart)
        .filter((item) => item.mpn.length > 0 && normalizeMpn(item.mpn) === requestedMpn)
        .slice(0, 1);
      return { items };
    },
  };
}
