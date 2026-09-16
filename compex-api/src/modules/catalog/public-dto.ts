import type { Category, Manufacturer, Product } from "@prisma/client";

// Public-safe specification allowlist rule (Phase 10 privacy fix): provider
// attribute names (Mouser/DigiKey/element14 parametric data, or an admin CSV
// import) are customer-facing product facts by default -- resistance,
// voltage, package, tolerance, etc. This denylist blocks the internal-sounding
// categories a future source could introduce, without stripping legitimate
// spec names that happen to share a word (e.g. "Package / Case", "Source
// Voltage" on a MOSFET are never touched -- only whole internal terms match).
const INTERNAL_SPEC_KEY_PATTERN =
  /internal|private|admin|provider|supplier|vendor|canonical|traceability|sourcing|margin|moq|sku|stock|cost|price|lead\s*time/i;

export function isPublicSafeSpecKey(name: string): boolean {
  return !INTERNAL_SPEC_KEY_PATTERN.test(name);
}

// Some provider parametric attribute names are literally branded with the
// distributor's own name (DigiKey's "DigiKey Programmable" flag being the
// concrete case that surfaced on production). These are legitimate public
// facts about the part, so they are not stripped like the internal keys
// above -- but the customer-facing label must never name a specific
// distributor. This strips the brand token from the label only; the value
// is untouched.
const PROVIDER_BRAND_TOKEN_PATTERN = /\b(digi-?key|mouser|element\s?14|newark|nexar|arrow|avnet)\b/gi;

export function sanitizeSpecKeyLabel(name: string): string {
  const stripped = name.replace(PROVIDER_BRAND_TOKEN_PATTERN, "").replace(/\s{2,}/g, " ").trim();
  return stripped.length > 0 ? stripped : "Attribute";
}

export function filterPublicSpecifications(specifications: unknown): Record<string, unknown> {
  const entries = Object.entries((specifications ?? {}) as Record<string, unknown>);
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (!isPublicSafeSpecKey(key)) continue;
    // Last write wins on the rare collision created by stripping a brand
    // token (e.g. two distinct provider keys both reducing to "Programmable").
    result[sanitizeSpecKeyLabel(key)] = value;
  }
  return result;
}

// Deliberately excludes source, sourceUrl, sourceProductId, normalizedMpn,
// importStatus, dataHash, lastImportedAt, isActive, createdAt, updatedAt,
// categoryId, manufacturerId -- internal sourcing/DB metadata never shown to
// public catalogue visitors (products.routes.ts / manufacturers.routes.ts).
// Also deliberately excludes every admin-only Product Master field added for
// the owner's Customer Master requirement (productCode, spq, packaging,
// uom, hsCode, hsDescription, productGroup, eccn, availableStock) -- an
// explicit allowlist below, not a spread, so a new admin-only column added
// to the Product model in the future is excluded by default rather than
// requiring someone to remember to deny-list it here.
export function toPublicProduct(product: Product & { manufacturer?: Manufacturer | null; category?: Category | null }) {
  return {
    id: product.id,
    mpn: product.mpn,
    name: product.name,
    description: product.description,
    specifications: filterPublicSpecifications(product.specifications),
    packageType: product.packageType,
    mountingType: product.mountingType,
    lifecycleStatus: product.lifecycleStatus,
    datasheetUrl: product.datasheetUrl,
    images: product.images,
    manufacturer: product.manufacturer ? toPublicManufacturer(product.manufacturer) : null,
    category: product.category ? toPublicCategory(product.category) : null,
  };
}

// Deliberately excludes source, sourceUrl -- internal sourcing metadata.
export function toPublicManufacturer(manufacturer: Manufacturer) {
  const { id, name, slug, logoUrl, website, description, country } = manufacturer;
  return { id, name, slug, logoUrl, website, description, country };
}

function toPublicCategory(category: Category) {
  const { id, name, description, parentId } = category;
  return { id, name, description, parentId };
}
