import { env } from "../../../config/env.js";
import { Errors } from "../../../lib/errors.js";
import type { CatalogFetcher, RawCatalogItem } from "../types.js";
import { normalizeMpn } from "../normalizer.js";
import { mapDigiKeyProduct, type DigiKeyProduct } from "./digikey-mapper.js";

// DigiKey Product Information V4 — OAuth2 client-credentials grant (no user
// context needed for catalog lookups) + a keyword search.
// Docs: https://developer.digikey.com/products/product-information/productinformation/v4
//
// Deliberately uses the keyword-search endpoint, not
// GET /products/v4/search/{productNumber}/productdetails: that endpoint
// requires the path segment to resolve to exactly one unambiguous DigiKey
// product and 404s with "Duplicate Products found ... provide
// manufacturerId" for any MPN multiple manufacturers share (verified live:
// ATMEGA328P-PU, 1N4148, LM7805CT all 404 that way despite being in DigiKey's
// catalog). Keyword search returns every candidate under that keyword so the
// existing exact-match filter below can pick the real one, same pattern the
// Mouser/element14 fetchers already use.
const TOKEN_URL = "https://api.digikey.com/v1/oauth2/token";
const KEYWORD_SEARCH_URL = "https://api.digikey.com/products/v4/search/keyword";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

// Real V4 shape (nested) — kept separate from digikey-mapper.ts's flatter
// `DigiKeyProduct` so the mapper (and its unit tests) stay independent of
// exactly how this fetcher's HTTP layer is shaped. Shared by both the
// keyword-search endpoint's `Products` array and a single product record.
interface DigiKeyV4Product {
  ManufacturerProductNumber?: string;
  ProductVariations?: Array<{ DigiKeyProductNumber?: string }>;
  Description?: { ProductDescription?: string; DetailedDescription?: string };
  Manufacturer?: { Name?: string };
  DatasheetUrl?: string;
  PhotoUrl?: string;
  ProductUrl?: string;
  Classifications?: { RohsStatus?: string };
  ProductStatus?: { Status?: string };
  Category?: { Name?: string };
  Parameters?: Array<{ ParameterText?: string; ValueText?: string }>;
}

interface DigiKeyKeywordSearchResponse {
  Products?: DigiKeyV4Product[];
}

// Module-level token cache — a client-credentials token is valid for the
// whole process, not per-request; refetching on every lookup would burn
// rate limit for no reason. Cleared (implicitly) on process restart.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) return cachedToken.value;
  if (!env.DIGIKEY_CLIENT_ID || !env.DIGIKEY_CLIENT_SECRET) {
    throw Errors.serviceUnavailable(
      "DIGIKEY_CLIENT_ID / DIGIKEY_CLIENT_SECRET are not configured. Register a production app at https://developer.digikey.com and set both in the server environment.",
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DIGIKEY_CLIENT_ID,
      client_secret: env.DIGIKEY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  const body = (await res.json()) as TokenResponse;
  if (!res.ok || !body.access_token) {
    throw Errors.serviceUnavailable(`DigiKey OAuth token request failed: ${body.error_description ?? body.error ?? res.status}`);
  }

  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 600) * 1000 };
  return cachedToken.value;
}

function toDigiKeyProduct(details: DigiKeyV4Product | undefined): DigiKeyProduct {
  if (!details) return {};
  return {
    ManufacturerPartNumber: details.ManufacturerProductNumber,
    DigiKeyProductNumber: details.ProductVariations?.[0]?.DigiKeyProductNumber,
    ProductDescription: details.Description?.ProductDescription,
    DetailedDescription: details.Description?.DetailedDescription,
    Manufacturer: details.Manufacturer?.Name,
    PrimaryDatasheet: details.DatasheetUrl,
    PrimaryPhoto: details.PhotoUrl,
    ProductUrl: details.ProductUrl,
    RoHSStatus: details.Classifications?.RohsStatus,
    Obsolete: details.ProductStatus?.Status === "Obsolete",
    Category: details.Category?.Name,
    Parameters: details.Parameters?.map((p) => ({ Parameter: p.ParameterText, Value: p.ValueText })),
  };
}

// Single-MPN lookup, same shape as the Mouser/element14 fetchers so it
// plugs into the shared run-import.ts pipeline (retry/idempotency/
// CatalogImportRun tracking) unchanged.
export function createDigiKeyFetcher(mpn: string): CatalogFetcher {
  return {
    source: "DIGIKEY",
    async fetch(): Promise<{ items: RawCatalogItem[] }> {
      const token = await getAccessToken();

      const res = await fetch(KEYWORD_SEARCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID ?? "",
          "X-DIGIKEY-Locale-Site": "US",
          "X-DIGIKEY-Locale-Language": "en",
          "X-DIGIKEY-Locale-Currency": "USD",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ Keywords: mpn, Limit: 10, Offset: 0 }),
      });

      if (res.status === 429) {
        throw Errors.rateLimited();
      }
      if (!res.ok) {
        throw Errors.serviceUnavailable(`DigiKey API request failed with status ${res.status}`);
      }

      const body = (await res.json()) as DigiKeyKeywordSearchResponse;
      const requestedMpn = normalizeMpn(mpn);
      const items = (body.Products ?? [])
        .map((product) => mapDigiKeyProduct(toDigiKeyProduct(product)))
        .filter((item) => item.mpn.length > 0 && normalizeMpn(item.mpn) === requestedMpn)
        .slice(0, 1);
      return { items };
    },
  };
}
