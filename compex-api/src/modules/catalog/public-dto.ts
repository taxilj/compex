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

export function filterPublicSpecifications(specifications: unknown): Record<string, unknown> {
  const entries = Object.entries((specifications ?? {}) as Record<string, unknown>);
  return Object.fromEntries(entries.filter(([key]) => isPublicSafeSpecKey(key)));
}

// Deliberately excludes source, sourceUrl, sourceProductId, normalizedMpn,
// importStatus, dataHash, lastImportedAt, isActive, createdAt, updatedAt,
// categoryId, manufacturerId -- internal sourcing/DB metadata never shown to
// public catalogue visitors (products.routes.ts / manufacturers.routes.ts).
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
