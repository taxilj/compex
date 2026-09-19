-- Composite indexes for the public catalogue list (filter on is_active, then
-- stable mpn order / category / manufacturer). Additive and non-destructive.
CREATE INDEX IF NOT EXISTS "products_is_active_mpn_idx" ON "products"("is_active", "mpn");
CREATE INDEX IF NOT EXISTS "products_is_active_category_id_idx" ON "products"("is_active", "category_id");
CREATE INDEX IF NOT EXISTS "products_is_active_manufacturer_id_idx" ON "products"("is_active", "manufacturer_id");
