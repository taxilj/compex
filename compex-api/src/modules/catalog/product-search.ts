import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { normalizeMpn } from "../catalog-import/normalizer.js";

export const PRODUCT_INCLUDE = {
  manufacturer: true,
  category: true,
} satisfies Prisma.ProductInclude;

export interface ProductListFilters {
  q?: string;
  categoryId?: string;
  manufacturerId?: string;
  packageType?: string;
  lifecycleStatus?: string;
  importStatus?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

// Exact-MPN-first search: Postgres ILIKE is sufficient at current catalog
// scale (see PHASE 5 — no Elasticsearch until it measurably isn't). A
// case-insensitive exact MPN match is pinned as result #1; everything else
// (mpn/name/description/manufacturer substring match) fills the rest,
// ordered by name. Upgrade point: swap to a trigram/full-text index + rank()
// if `contains` scans become a bottleneck.
export async function searchProducts(filters: ProductListFilters) {
  const { q, categoryId, manufacturerId, packageType, lifecycleStatus, importStatus, isActive, page, limit } = filters;

  const baseWhere: Prisma.ProductWhereInput = {
    ...(isActive !== undefined && { isActive }),
    ...(categoryId && { categoryId }),
    ...(manufacturerId && { manufacturerId }),
    ...(packageType && { packageType }),
    ...(lifecycleStatus && { lifecycleStatus }),
    ...(importStatus && { importStatus }),
  };

  if (!q) {
    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({ where: baseWhere, include: PRODUCT_INCLUDE, orderBy: { mpn: "asc" }, skip: (page - 1) * limit, take: limit }),
      prisma.product.count({ where: baseWhere }),
    ]);
    return { data, total };
  }

  const exactMatch = await prisma.product.findFirst({
    where: { ...baseWhere, normalizedMpn: normalizeMpn(q) },
    include: PRODUCT_INCLUDE,
  });

  const containsWhere: Prisma.ProductWhereInput = {
    ...baseWhere,
    ...(exactMatch ? { id: { not: exactMatch.id } } : {}),
    OR: [
      { mpn: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { manufacturer: { name: { contains: q, mode: "insensitive" } } },
    ],
  };

  const containsTotal = await prisma.product.count({ where: containsWhere });
  const total = containsTotal + (exactMatch ? 1 : 0);

  const exactOffset = exactMatch ? 1 : 0;
  const skip = Math.max(0, (page - 1) * limit - exactOffset);
  const take = page === 1 ? Math.max(0, limit - exactOffset) : limit;

  const rest = await prisma.product.findMany({
    where: containsWhere,
    include: PRODUCT_INCLUDE,
    orderBy: { name: "asc" },
    skip,
    take,
  });

  const data = page === 1 && exactMatch ? [exactMatch, ...rest] : rest;
  return { data, total };
}
