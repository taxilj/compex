import { env } from "../../../config/env.js";
import { Errors } from "../../../lib/errors.js";
import type { CatalogFetcher, RawCatalogItem } from "../types.js";
import { normalizeMpn } from "../normalizer.js";
import { mapDigiKeyProduct, type DigiKeyProduct } from "./digikey-mapper.js";

// DigiKey Product Information V4 — OAuth2 client-credentials grant (no user
// context needed for catalog lookups) + a single-part detail lookup.
// Docs: https://developer.digikey.com/products/product-information/productinformation/v4
const TOKEN_URL = "https://api.digikey.com/v1/oauth2/token";
const PRODUCT_DETAILS_URL = "https://api.digikey.com/products/v4/search";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

// Real V4 shape (nested) — kept separate from digikey-mapper.ts's flatter
// `DigiKeyProduct` so the mapper (and its unit tests) stay independent of
// exactly how this fetcher's HTTP layer is shaped.
interface DigiKeyV4ProductDetails {
  Product?: {
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
  };
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

function toDigiKeyProduct(details: DigiKeyV4ProductDetails["Product"]): DigiKeyProduct {
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
      const url = `${PRODUCT_DETAILS_URL}/${encodeURIComponent(mpn)}/productdetails`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID ?? "",
          "X-DIGIKEY-Locale-Site": "US",
          "X-DIGIKEY-Locale-Language": "en",
          "X-DIGIKEY-Locale-Currency": "USD",
          Accept: "application/json",
        },
      });

      if (res.status === 404) return { items: [] };
      if (res.status === 429) {
        throw Errors.rateLimited();
      }
      if (!res.ok) {
        throw Errors.serviceUnavailable(`DigiKey API request failed with status ${res.status}`);
      }

      const body = (await res.json()) as DigiKeyV4ProductDetails;
      const item = mapDigiKeyProduct(toDigiKeyProduct(body.Product));
      return { items: item.mpn && normalizeMpn(item.mpn) === normalizeMpn(mpn) ? [item] : [] };
    },
  };
}
