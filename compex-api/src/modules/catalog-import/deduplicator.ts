import crypto from "node:crypto";
import type { NormalizedProduct } from "./normalizer.js";

// Stable hash over every field an import can change. upsert.ts compares this
// against the existing Product.dataHash to skip a no-op write — this is what
// makes re-running the same import idempotent instead of just "not erroring."
export function computeDataHash(item: NormalizedProduct): string {
  const stable = {
    name: item.name ?? null,
    description: item.description ?? null,
    manufacturerId: item.manufacturerId ?? null,
    categoryId: item.categoryId ?? null,
    packageType: item.packageType ?? null,
    mountingType: item.mountingType ?? null,
    lifecycleStatus: item.lifecycleStatus ?? null,
    datasheetUrl: item.datasheetUrl ?? null,
    sourceUrl: item.sourceUrl ?? null,
    images: item.images ?? null,
    specifications: item.specifications ?? null,
    // Included so a refreshed price/stock/MOQ snapshot from a source like
    // Nexar is recognised as a real change (ProductSource gets re-imported)
    // rather than being silently skipped as "unchanged" -- it never affects
    // the Product row itself, only ProductSource.
    internalOffers: item.internalOffers ?? null,
  };
  return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
