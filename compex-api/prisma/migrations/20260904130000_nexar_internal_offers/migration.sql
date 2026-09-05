-- Adds an internal-only column to product_sources for commercial/sourcing
-- data that a live provider may return alongside catalog facts (seller
-- name, price, stock, MOQ, lead time, offer URL) -- introduced for the
-- Nexar Supply integration (Phase 5/6 of the Nexar task: pricing may be
-- collected for INTERNAL SOURCING only and must never reach the public
-- catalog).
--
-- Safe/additive: nullable column, no backfill needed. Existing rows (and
-- every existing source's mapper: Mouser/element14/DigiKey, which never
-- capture pricing at all) simply leave it NULL. The public product API
-- (GET /api/v1/products/:mpn) never selects `sources`, so this column is
-- unreachable from any customer-facing response by construction.

ALTER TABLE "product_sources" ADD COLUMN "internal_offers" JSONB;
