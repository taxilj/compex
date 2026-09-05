import { env } from "../../config/env.js";
import { cacheGet, cacheSet } from "../../lib/cache.js";
import { Errors } from "../../lib/errors.js";
import { nexarGraphQL } from "../catalog-import/fetchers/nexar-client.js";

export type PublicProduct = {
  mpn: string;
  manufacturer: string;
  productName: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  datasheetUrl?: string;
  lifecycleStatus?: string;
  compliance?: string[];
  specifications: Array<{ name: string; value: string }>;
};

interface NexarPublicSpec {
  attribute?: { name?: string; shortname?: string; group?: string };
  displayValue?: string;
}

interface NexarPublicPart {
  mpn?: string;
  manufacturer?: { name?: string };
  category?: { name?: string };
  shortDescription?: string;
  images?: Array<{ url?: string }>;
  bestDatasheet?: { url?: string };
  specs?: NexarPublicSpec[];
}

interface NexarPublicLookupResponse {
  supSearchMpn?: { results?: Array<{ part?: NexarPublicPart }> };
}

const CACHE_NAMESPACE = "public-nexar-mpn-lookup";
const SEARCH_LIMIT = 5;
const MAX_MPN_LENGTH = 100;
const MAX_SPECIFICATIONS = 50;

// Intentionally facts-only. Do not add sellers, offers, prices, inventory,
// MOQ, lead time, or click URLs to this query: this service is public.
const PUBLIC_MPN_LOOKUP_QUERY = /* GraphQL */ `
  query CompexPublicNexarMpnLookup($mpn: String!, $limit: Int!) {
    supSearchMpn(q: $mpn, limit: $limit) {
      results {
        part {
          mpn
          manufacturer { name }
          category { name }
          shortDescription
          images { url }
          bestDatasheet { url }
          specs {
            attribute { name shortname group }
            displayValue
          }
        }
      }
    }
  }
`;

function cleanText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function publicUrl(value: unknown): string | undefined {
  const text = cleanText(value, 2_000);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Keeps the submitted part number readable for Nexar while using the same
 * formatting-insensitive matching rule as the import pipeline.
 */
export function normalizePublicMpn(value: string): string {
  const mpn = value.trim().toUpperCase();
  if (!mpn) throw Errors.validation("MPN is required");
  if (mpn.length > MAX_MPN_LENGTH) throw Errors.validation(`MPN must be ${MAX_MPN_LENGTH} characters or fewer`);
  if (!/^[A-Z0-9][A-Z0-9 ._+/#-]*$/.test(mpn)) throw Errors.validation("MPN contains invalid characters");
  return mpn;
}

function exactMatchKey(mpn: string): string {
  return mpn.replace(/[^A-Z0-9]/g, "");
}

function isComplianceSpec(spec: NexarPublicSpec): boolean {
  const text = `${spec.attribute?.name ?? ""} ${spec.attribute?.shortname ?? ""} ${spec.attribute?.group ?? ""}`.toLowerCase();
  return /rohs|reach|compliance|conflict mineral/.test(text);
}

function isLifecycleSpec(spec: NexarPublicSpec): boolean {
  const text = `${spec.attribute?.name ?? ""} ${spec.attribute?.shortname ?? ""}`.toLowerCase();
  return /lifecycle/.test(text);
}

export function mapNexarPublicProduct(part: NexarPublicPart): PublicProduct | null {
  const mpn = cleanText(part.mpn, MAX_MPN_LENGTH);
  if (!mpn) return null;

  const specifications = (part.specs ?? [])
    .map((spec) => ({ name: cleanText(spec.attribute?.name, 150), value: cleanText(spec.displayValue, 500), raw: spec }))
    .filter((spec): spec is { name: string; value: string; raw: NexarPublicSpec } => Boolean(spec.name && spec.value))
    .slice(0, MAX_SPECIFICATIONS);
  const lifecycleStatus = specifications.find((spec) => isLifecycleSpec(spec.raw))?.value;
  const compliance = specifications.filter((spec) => isComplianceSpec(spec.raw)).map((spec) => spec.value);

  return {
    mpn,
    manufacturer: cleanText(part.manufacturer?.name, 200) ?? "Unknown manufacturer",
    productName: cleanText(part.shortDescription, 500) ?? mpn,
    description: cleanText(part.shortDescription, 2_000),
    category: cleanText(part.category?.name, 200),
    imageUrl: (part.images ?? []).map((image) => publicUrl(image.url)).find((url): url is string => Boolean(url)),
    datasheetUrl: publicUrl(part.bestDatasheet?.url),
    lifecycleStatus,
    ...(compliance.length ? { compliance: [...new Set(compliance)] } : {}),
    specifications: specifications.map(({ name, value }) => ({ name, value })),
  };
}

export async function lookupPublicProduct(input: string): Promise<PublicProduct | null> {
  const mpn = normalizePublicMpn(input);
  const cacheKey = exactMatchKey(mpn);
  const cached = await cacheGet<PublicProduct | null>(CACHE_NAMESPACE, cacheKey);
  if (cached) return cached.value;

  const data = await nexarGraphQL<NexarPublicLookupResponse>(PUBLIC_MPN_LOOKUP_QUERY, { mpn, limit: SEARCH_LIMIT });
  const match = (data.supSearchMpn?.results ?? [])
    .map((result) => result.part)
    .find((part): part is NexarPublicPart => Boolean(part?.mpn && exactMatchKey(part.mpn.toUpperCase()) === cacheKey));
  const product = match ? mapNexarPublicProduct(match) : null;

  // Both a factual match and a factual miss are safe to cache briefly. An
  // upstream failure throws before this point and can never poison the cache.
  await cacheSet(CACHE_NAMESPACE, cacheKey, product, Math.min(env.NEXAR_CACHE_TTL_SECONDS, 300));
  return product;
}
