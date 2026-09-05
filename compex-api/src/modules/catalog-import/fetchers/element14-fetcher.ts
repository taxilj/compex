import { env } from "../../../config/env.js";
import { Errors } from "../../../lib/errors.js";
import type { CatalogFetcher, RawCatalogItem } from "../types.js";
import { normalizeMpn } from "../normalizer.js";

// Official element14 Product Search API. Field names are intentionally
// defensive because the response's optional content varies by distributor
// region and response group. This adapter never imports commercial price data.
const ELEMENT14_PRODUCTS_URL = "https://api.element14.com/catalog/products";

interface Element14Attribute {
  attributeLabel?: string;
  attributeValue?: string;
  label?: string;
  value?: string;
  name?: string;
}

export interface Element14Product {
  sku?: string;
  displayName?: string;
  brandName?: string;
  translatedManufacturerPartNumber?: string;
  manufacturerPartNumber?: string;
  productDescription?: string;
  description?: string;
  productURL?: string;
  productUrl?: string;
  datasheets?: Array<{ url?: string; datasheetUrl?: string }>;
  image?: { url?: string; baseName?: string } | string;
  attributes?: Element14Attribute[];
  technicalAttributes?: Element14Attribute[];
  category?: { name?: string } | string;
  categoryName?: string;
  rohsStatus?: string;
  rohsStatusCode?: string;
  lifecycleStatus?: string;
  productStatus?: string;
}

interface Element14Response {
  products?: Element14Product[];
  Products?: Element14Product[];
  manufacturerPartNumberSearchReturn?: {
    products?: Element14Product[];
  };
  fault?: { message?: string };
}

function validUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function imageUrl(image: Element14Product["image"], storeId: string): string | undefined {
  const value = typeof image === "string" ? image : image?.url;
  const direct = validUrl(value);
  if (direct) return direct;

  // The live Product Search API returns only a filename-style baseName (for
  // example, /GE48LQFP05-40.jpg). Element14 serves that asset beneath this
  // public image path. Keep the provider host derived from server
  // configuration; never expose or construct a credential URL.
  const baseName = typeof image === "object" ? image?.baseName : undefined;
  if (baseName?.startsWith("/")) return validUrl(`https://${storeId}/productimages/standard/en_GB${baseName}`);
  return undefined;
}

export function extractElement14Products(response: Element14Response): Element14Product[] {
  return response.manufacturerPartNumberSearchReturn?.products ?? response.products ?? response.Products ?? [];
}

export function mapElement14Part(part: Element14Product, storeId = "in.element14.com"): RawCatalogItem {
  const specifications: Record<string, unknown> = {};
  for (const attribute of [...(part.attributes ?? []), ...(part.technicalAttributes ?? [])]) {
    const name = attribute.attributeLabel ?? attribute.label ?? attribute.name;
    const value = attribute.attributeValue ?? attribute.value;
    if (name && value) specifications[name] = value;
  }
  if (part.rohsStatus ?? part.rohsStatusCode) specifications.rohsStatus = part.rohsStatus ?? part.rohsStatusCode!;

  const packageKey = Object.keys(specifications).find((key) => /package|case/i.test(key));
  const image = imageUrl(part.image, storeId);
  const category = typeof part.category === "string" ? part.category : part.category?.name;

  return {
    mpn: part.translatedManufacturerPartNumber?.trim() || part.manufacturerPartNumber?.trim() || "",
    manufacturer: part.brandName,
    name: part.displayName,
    description: part.productDescription ?? part.description,
    category: category ?? part.categoryName,
    packageType: packageKey ? String(specifications[packageKey]) : undefined,
    lifecycleStatus: part.lifecycleStatus ?? part.productStatus,
    datasheetUrl: validUrl(part.datasheets?.[0]?.url ?? part.datasheets?.[0]?.datasheetUrl),
    sourceProductId: part.sku,
    sourceUrl: validUrl(part.productURL ?? part.productUrl),
    images: image ? [image] : undefined,
    specifications: Object.keys(specifications).length ? specifications : undefined,
  };
}

export function createElement14Fetcher(mpn: string): CatalogFetcher {
  return {
    source: "ELEMENT14",
    async fetch(): Promise<{ items: RawCatalogItem[] }> {
      if (!env.ELEMENT14_API_KEY) {
        throw Errors.serviceUnavailable(
          "ELEMENT14_API_KEY is not configured. Register an approved Product Search API key with element14 and set it in the server environment.",
        );
      }

      const url = new URL(ELEMENT14_PRODUCTS_URL);
      url.searchParams.set("term", `manuPartNum:${mpn}`);
      url.searchParams.set("storeInfo.id", env.ELEMENT14_STORE_ID);
      // `large` is required by the live API for technical attributes and
      // product image metadata. Commercial `prices` may also be present in
      // that response, but mapElement14Part deliberately never reads it.
      url.searchParams.set("resultsSettings.responseGroup", "large");
      url.searchParams.set("callInfo.responseDataFormat", "json");
      url.searchParams.set("callInfo.apiKey", env.ELEMENT14_API_KEY);

      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (response.status === 429) throw Errors.rateLimited();
      if (!response.ok) throw Errors.serviceUnavailable(`element14 API request failed with status ${response.status}`);

      const body = await response.json() as Element14Response;
      if (body.fault?.message) throw Errors.serviceUnavailable(`element14 API error: ${body.fault.message}`);
      const requestedMpn = normalizeMpn(mpn);
      const exactMatches = extractElement14Products(body)
        .map((part) => mapElement14Part(part, env.ELEMENT14_STORE_ID))
        .filter((item) => item.mpn.length > 0 && normalizeMpn(item.mpn) === requestedMpn);
      return {
        // Provider responses can contain multiple packaging listings for one
        // exact manufacturer MPN. This is a single-MPN import endpoint, so
        // retain only the first exact product rather than treating those
        // listings as separate canonical imports.
        items: exactMatches.slice(0, 1),
      };
    },
  };
}
