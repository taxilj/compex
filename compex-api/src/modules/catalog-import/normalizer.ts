import { prisma } from "../../lib/prisma.js";
import type { ValidatedCatalogItem } from "./validator.js";

export interface NormalizedProduct {
  mpn: string;
  name?: string;
  description?: string;
  manufacturerId?: string;
  categoryId?: string;
  packageType?: string;
  mountingType?: string;
  lifecycleStatus?: string;
  datasheetUrl?: string;
  sourceProductId?: string;
  sourceUrl?: string;
  images?: string[];
  specifications?: Record<string, unknown>;
  internalOffers?: unknown[];
}

// MPN formatting is not stable between distributors (for example, "ABC-123"
// and "abc 123"). Keep the supplier's original MPN for display, but use this
// deterministic key for matching and search.
export function normalizeMpn(mpn: string): string {
  return mpn.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Resolves the source's plain-text manufacturer/category strings to real
// catalog rows, creating them on first sight (source-tagged) and reusing
// them on every later import — this is the MPN + manufacturer matching the
// task calls for, since Product.mpn is globally unique in this schema.
export async function normalizeItem(item: ValidatedCatalogItem, source: string): Promise<NormalizedProduct> {
  let manufacturerId: string | undefined;
  if (item.manufacturer) {
    const slug = slugify(item.manufacturer);
    const manufacturer = await prisma.manufacturer.upsert({
      where: { slug },
      create: { name: item.manufacturer, slug, source },
      update: {},
    });
    manufacturerId = manufacturer.id;
  }

  let categoryId: string | undefined;
  if (item.category) {
    const category = await prisma.category.upsert({
      where: { name: item.category },
      create: { name: item.category },
      update: {},
    });
    categoryId = category.id;
  }

  return {
    mpn: item.mpn,
    name: item.name,
    description: item.description,
    manufacturerId,
    categoryId,
    packageType: item.packageType,
    mountingType: item.mountingType,
    lifecycleStatus: item.lifecycleStatus,
    datasheetUrl: item.datasheetUrl,
    sourceProductId: item.sourceProductId,
    sourceUrl: item.sourceUrl,
    images: item.images,
    specifications: item.specifications,
    internalOffers: item.internalOffers,
  };
}
