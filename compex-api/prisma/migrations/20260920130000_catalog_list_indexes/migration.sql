-- Speeds up the public catalogue list total (COUNT of active products, ~3x on
-- 50k rows). One statement, built CONCURRENTLY so writes to products (imports,
-- admin edits) are not blocked while it builds. Additive and idempotent.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "products_is_active_mpn_idx" ON "products"("is_active", "mpn");
