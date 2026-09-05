-- Manufacturer: richer profile + provenance
ALTER TABLE "manufacturers" ADD COLUMN "description" TEXT;
ALTER TABLE "manufacturers" ADD COLUMN "country" TEXT;
ALTER TABLE "manufacturers" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "manufacturers" ADD COLUMN "source_url" TEXT;

-- Category: subcategory hierarchy
ALTER TABLE "categories" ADD COLUMN "parent_id" UUID;
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Product: full catalog fields + provenance/import tracking
ALTER TABLE "products" ADD COLUMN "name" TEXT;
ALTER TABLE "products" ADD COLUMN "specifications" JSONB;
ALTER TABLE "products" ADD COLUMN "package_type" TEXT;
ALTER TABLE "products" ADD COLUMN "mounting_type" TEXT;
ALTER TABLE "products" ADD COLUMN "lifecycle_status" TEXT;
ALTER TABLE "products" ADD COLUMN "datasheet_url" TEXT;
ALTER TABLE "products" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "products" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "products" ADD COLUMN "source_url" TEXT;
ALTER TABLE "products" ADD COLUMN "source_product_id" TEXT;
ALTER TABLE "products" ADD COLUMN "last_imported_at" TIMESTAMPTZ;
ALTER TABLE "products" ADD COLUMN "data_hash" TEXT;
ALTER TABLE "products" ADD COLUMN "import_status" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "products" ADD COLUMN "normalized_mpn" TEXT;
UPDATE "products" SET "normalized_mpn" = regexp_replace(upper("mpn"), '[^A-Z0-9]', '', 'g');
ALTER TABLE "products" ALTER COLUMN "normalized_mpn" SET NOT NULL;
CREATE UNIQUE INDEX "products_normalized_mpn_key" ON "products"("normalized_mpn");

CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_manufacturer_id_idx" ON "products"("manufacturer_id");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- A canonical product can be backed by more than one approved provider.
CREATE TABLE "product_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "source_product_id" TEXT,
  "source_url" TEXT,
  "datasheet_url" TEXT,
  "images" TEXT[] NOT NULL DEFAULT '{}',
  "specifications" JSONB,
  "lifecycle_status" TEXT,
  "data_hash" TEXT,
  "last_imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_sources_product_id_source_key" ON "product_sources"("product_id", "source");
CREATE INDEX "product_sources_source_source_product_id_idx" ON "product_sources"("source", "source_product_id");
ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catalog import run tracking (Phase 7)
CREATE TABLE "catalog_import_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "cursor" TEXT,
  "items_processed" INTEGER NOT NULL DEFAULT 0,
  "items_created" INTEGER NOT NULL DEFAULT 0,
  "items_updated" INTEGER NOT NULL DEFAULT 0,
  "items_failed" INTEGER NOT NULL DEFAULT 0,
  "error_log" JSONB,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "catalog_import_runs_pkey" PRIMARY KEY ("id")
);

-- Nullable Product link on RFQ / Quotation / Lead line items (backward compatible;
-- free-text mpn/manufacturer columns are untouched and remain the source of truth
-- for manual entry and BOM upload).
ALTER TABLE "rfq_items" ADD COLUMN "product_id" UUID;
CREATE INDEX "rfq_items_product_id_idx" ON "rfq_items"("product_id");
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotation_items" ADD COLUMN "product_id" UUID;
CREATE INDEX "quotation_items_product_id_idx" ON "quotation_items"("product_id");
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lead_items" ADD COLUMN "product_id" UUID;
CREATE INDEX "lead_items_product_id_idx" ON "lead_items"("product_id");
ALTER TABLE "lead_items" ADD CONSTRAINT "lead_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
