import type { RawCatalogItem } from "../types.js";

// Nexar Supply (api.nexar.com/graphql) Part shape, restricted to exactly the
// fields nexar-fetcher.ts's query requests. Field names below were sourced
// from Nexar's own support documentation (Playground/Query-Templates/
// Migration articles at support.nexar.com) and Nexar's public sample
// clients, since no NEXAR_CLIENT_ID/SECRET were available in this
// environment to introspect the live schema directly (Phase 4 explicitly
// forbids guessing; this is the closest verifiable substitute -- confirm
// against the Nitro IDE "Schema Reference" / api.nexar.com/ui/voyager the
// first time real credentials are configured, per Phase 4's own guidance).
export interface NexarAttribute {
  name?: string;
  shortname?: string;
  group?: string;
}

export interface NexarSpec {
  attribute?: NexarAttribute;
  displayValue?: string;
}

export interface NexarImage {
  url?: string;
  creditString?: string;
  creditUrl?: string;
}

export interface NexarDocument {
  name?: string;
  url?: string;
  mimeType?: string;
}

export interface NexarDocumentCollection {
  name?: string;
  documents?: NexarDocument[];
}

export interface NexarOfferPrice {
  quantity?: number;
  price?: number;
  currency?: string;
}

export interface NexarOffer {
  sku?: string;
  inventoryLevel?: number;
  moq?: number;
  packaging?: string;
  factoryLeadDays?: number;
  clickUrl?: string;
  prices?: NexarOfferPrice[];
}

export interface NexarSeller {
  company?: { name?: string; homepageUrl?: string };
  country?: string;
  isRfq?: boolean;
  offers?: NexarOffer[];
}

export interface NexarPart {
  mpn?: string;
  slug?: string;
  manufacturer?: { name?: string; homepageUrl?: string };
  category?: { id?: string; name?: string };
  shortDescription?: string;
  octopartUrl?: string;
  images?: NexarImage[];
  bestDatasheet?: { url?: string };
  documentCollections?: NexarDocumentCollection[];
  specs?: NexarSpec[];
  sellers?: NexarSeller[];
}

export interface NexarSearchMpnResult {
  hits?: number;
  results?: Array<{ part?: NexarPart }>;
}

// Internal-sourcing-only shape -- see prisma/schema.prisma's ProductSource.
// internalOffers comment. Never merged into RawCatalogItem's public fields.
export interface InternalOffer {
  seller?: string;
  sellerHomepageUrl?: string;
  country?: string;
  isRfq?: boolean;
  sku?: string;
  inventoryLevel?: number;
  moq?: number;
  packaging?: string;
  factoryLeadDays?: number;
  offerUrl?: string;
  prices?: NexarOfferPrice[];
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

// Nexar reports lifecycle status as a spec attribute (shortname
// "lifecyclestatus"/"manufacturerlifecyclestatus"), not a dedicated Part
// field -- see support.nexar.com "Supply: Lifecycle information for parts".
const LIFECYCLE_ATTRIBUTE_PATTERN = /^lifecyclestatus$/i;
const ROHS_ATTRIBUTE_PATTERN = /rohs|compliance/i;
const PACKAGE_ATTRIBUTE_PATTERN = /package|case/i;

// Public-safe mapping: Part -> RawCatalogItem. Mirrors the Mouser/element14/
// DigiKey mappers exactly -- specs fold into `specifications`, nothing here
// ever reads sellers/offers/pricing. That happens separately in
// mapNexarInternalOffers() below, kept in its own function so it is
// impossible to accidentally merge into the public-facing object.
export function mapNexarPart(part: NexarPart): RawCatalogItem {
  const specifications: Record<string, unknown> = {};
  let lifecycleStatus: string | undefined;

  for (const spec of part.specs ?? []) {
    const name = spec.attribute?.name ?? spec.attribute?.shortname;
    const value = spec.displayValue;
    if (!name || value === undefined || value === null || value === "") continue;

    if (spec.attribute?.shortname && LIFECYCLE_ATTRIBUTE_PATTERN.test(spec.attribute.shortname)) {
      lifecycleStatus = value;
      continue; // surfaced as its own field below, not duplicated into specifications
    }
    specifications[name] = value;
  }

  const packageKey = Object.keys(specifications).find((key) => PACKAGE_ATTRIBUTE_PATTERN.test(key));
  const rohsKey = Object.keys(specifications).find((key) => ROHS_ATTRIBUTE_PATTERN.test(key));
  if (rohsKey) specifications.rohsStatus = specifications[rohsKey];

  const complianceDocs = (part.documentCollections ?? [])
    .flatMap((collection) => collection.documents ?? [])
    .map((doc) => validUrl(doc.url))
    .filter((url): url is string => Boolean(url));
  if (complianceDocs.length) specifications.complianceDocuments = complianceDocs;

  const images = (part.images ?? [])
    .map((image) => validUrl(image.url))
    .filter((url): url is string => Boolean(url));

  return {
    mpn: part.mpn?.trim() || "",
    manufacturer: part.manufacturer?.name,
    description: part.shortDescription,
    category: part.category?.name,
    packageType: packageKey ? String(specifications[packageKey]) : undefined,
    lifecycleStatus,
    datasheetUrl: validUrl(part.bestDatasheet?.url),
    sourceProductId: part.slug,
    sourceUrl: validUrl(part.octopartUrl),
    images: images.length ? images : undefined,
    specifications: Object.keys(specifications).length ? specifications : undefined,
  };
}

// Internal-sourcing-only mapping (Phase 5/6): seller, price, stock, MOQ,
// lead time, offer URL. Called separately from mapNexarPart() and stored
// only on ProductSource.internalOffers -- see nexar-fetcher.ts.
export function mapNexarInternalOffers(part: NexarPart): InternalOffer[] {
  const offers: InternalOffer[] = [];
  for (const seller of part.sellers ?? []) {
    for (const offer of seller.offers ?? []) {
      offers.push({
        seller: seller.company?.name,
        sellerHomepageUrl: validUrl(seller.company?.homepageUrl),
        country: seller.country,
        isRfq: seller.isRfq,
        sku: offer.sku,
        inventoryLevel: offer.inventoryLevel,
        moq: offer.moq,
        packaging: offer.packaging,
        factoryLeadDays: offer.factoryLeadDays,
        offerUrl: validUrl(offer.clickUrl),
        prices: offer.prices,
      });
    }
  }
  return offers;
}
