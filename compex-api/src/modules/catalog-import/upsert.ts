import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { NormalizedProduct } from "./normalizer.js";
import { computeDataHash } from "./deduplicator.js";
import { normalizeMpn } from "./normalizer.js";

export type UpsertOutcome = "created" | "updated" | "unchanged";

export interface UpsertResult {
  outcome: UpsertOutcome;
  productId: string;
}

type ExistingProduct = { id: string; source: string; dataHash: string | null };
const EXISTING_SELECT = { id: true, source: true, dataHash: true } as const;

// Manufacturer-aware canonical matching. Two different real manufacturers
// can legitimately share an MPN string, so plain normalizedMpn matching
// (the old behaviour) risked silently merging unrelated parts into one
// canonical Product. This resolves, in order:
//  1. Same normalizedMpn + same manufacturerId -> the correct existing row.
//  2. Same normalizedMpn + an existing row with NO manufacturer on file yet
//     -> adopt it (a prior sparse import can be completed by a richer one,
//     rather than creating a second row for the same physical part).
//  3. No manufacturerId on this item at all -> fall back to plain
//     normalizedMpn matching (oldest row first), since there is no signal
//     to disambiguate — this only affects sources that never send a
//     manufacturer name, and keeps re-imports of that sparse source
//     idempotent instead of duplicating a row on every run.
//  4. Otherwise -> null, so upsertProduct creates a new, separate Product
//     for what the data says is a different manufacturer's part.
async function findExistingProduct(normalizedMpn: string, manufacturerId?: string): Promise<ExistingProduct | null> {
  if (manufacturerId) {
    const sameManufacturer = await prisma.product.findFirst({
      where: { normalizedMpn, manufacturerId },
      select: EXISTING_SELECT,
    });
    if (sameManufacturer) return sameManufacturer;

    return prisma.product.findFirst({
      where: { normalizedMpn, manufacturerId: null },
      select: EXISTING_SELECT,
    });
  }

  return prisma.product.findFirst({
    where: { normalizedMpn },
    orderBy: { createdAt: "asc" },
    select: EXISTING_SELECT,
  });
}

export async function upsertProduct(item: NormalizedProduct, source: string): Promise<UpsertResult> {
  const dataHash = computeDataHash(item);
  const normalizedMpn = normalizeMpn(item.mpn);
  const existing = await findExistingProduct(normalizedMpn, item.manufacturerId);
  const existingSource = existing
    ? await prisma.productSource.findUnique({
        where: { productId_source: { productId: existing.id, source } },
        select: { dataHash: true },
      })
    : null;

  if (existing && existingSource?.dataHash === dataHash) return { outcome: "unchanged", productId: existing.id };

  const shared = {
    name: item.name,
    description: item.description,
    manufacturerId: item.manufacturerId,
    categoryId: item.categoryId,
    packageType: item.packageType,
    mountingType: item.mountingType,
    lifecycleStatus: item.lifecycleStatus,
    datasheetUrl: item.datasheetUrl,
    source,
    sourceProductId: item.sourceProductId,
    sourceUrl: item.sourceUrl,
    images: item.images,
    specifications: item.specifications as Prisma.InputJsonValue | undefined,
    dataHash,
    importStatus: "IMPORTED" as const,
    lastImportedAt: new Date(),
  };

  // First source becomes the canonical public record. Re-importing that source
  // refreshes it; another approved source is retained below without silently
  // replacing customer-visible details or attribution.
  const product = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: existing.source === source ? shared : { lastImportedAt: new Date() },
        select: { id: true },
      })
    : await prisma.product.create({
        data: { mpn: item.mpn, normalizedMpn, ...shared },
        select: { id: true },
      });

  // internalOffers is intentionally only ever written here, on
  // ProductSource -- never on `shared` above, which feeds the public
  // Product row. See prisma/schema.prisma's ProductSource.internalOffers
  // comment and nexar-mapper.ts's InternalOffer type.
  const internalOffers = item.internalOffers as Prisma.InputJsonValue | undefined;

  await prisma.productSource.upsert({
    where: { productId_source: { productId: product.id, source } },
    create: {
      productId: product.id,
      source,
      sourceProductId: item.sourceProductId,
      sourceUrl: item.sourceUrl,
      datasheetUrl: item.datasheetUrl,
      images: item.images ?? [],
      specifications: item.specifications as Prisma.InputJsonValue | undefined,
      internalOffers,
      lifecycleStatus: item.lifecycleStatus,
      dataHash,
    },
    update: {
      sourceProductId: item.sourceProductId,
      sourceUrl: item.sourceUrl,
      datasheetUrl: item.datasheetUrl,
      images: item.images ?? [],
      specifications: item.specifications as Prisma.InputJsonValue | undefined,
      internalOffers,
      lifecycleStatus: item.lifecycleStatus,
      dataHash,
      lastImportedAt: new Date(),
    },
  });

  return { outcome: existing ? "updated" : "created", productId: product.id };
}
