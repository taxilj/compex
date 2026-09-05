-- Manufacturer-aware canonical product dedup.
--
-- Before: products.mpn and products.normalized_mpn were each globally
-- UNIQUE, so two different real manufacturers sharing the same MPN string
-- could never both exist. Safe to loosen: since normalized_mpn was already
-- globally unique, every existing row trivially satisfies the new, looser
-- composite constraint below -- this migration cannot fail on current data
-- and creates no duplicates.
--
-- After: normalized_mpn + manufacturer_id together identify the canonical
-- product. mpn/normalized_mpn remain indexed (non-unique) for search and
-- the public /products/:mpn lookup. See upsert.ts's findExistingProduct()
-- for the application-level matching rules (including the null-manufacturer
-- fallback, since Postgres treats NULL as distinct in a unique index).

DROP INDEX IF EXISTS "products_mpn_key";
DROP INDEX IF EXISTS "products_normalized_mpn_key";

CREATE INDEX IF NOT EXISTS "products_mpn_idx" ON "products"("mpn");
CREATE INDEX IF NOT EXISTS "products_normalized_mpn_idx" ON "products"("normalized_mpn");

CREATE UNIQUE INDEX IF NOT EXISTS "product_normalizedMpn_manufacturer_unique"
  ON "products"("normalized_mpn", "manufacturer_id");
