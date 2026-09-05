import { z } from "zod";

// Reject a row missing the one thing a catalog entry cannot exist without.
// Everything else is optional — sparse source data shouldn't fail the row.
export const RawCatalogItemSchema = z.object({
  mpn: z.string().trim().min(1).max(100),
  manufacturer: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(200).optional(),
  packageType: z.string().trim().max(100).optional(),
  mountingType: z.string().trim().max(100).optional(),
  lifecycleStatus: z.string().trim().max(50).optional(),
  datasheetUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  sourceProductId: z.string().trim().max(200).optional(),
  sourceUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  images: z.array(z.string().trim().url()).max(20).optional(),
  specifications: z.record(z.string(), z.unknown()).optional(),
  // Internal-sourcing-only offers (see types.ts's RawCatalogItem comment).
  // Intentionally z.unknown() per entry -- this is opaque internal data
  // persisted as-is on ProductSource.internalOffers, never validated as
  // public catalog content and never read by the public product API.
  internalOffers: z.array(z.unknown()).optional(),
});

export type ValidatedCatalogItem = z.infer<typeof RawCatalogItemSchema>;
