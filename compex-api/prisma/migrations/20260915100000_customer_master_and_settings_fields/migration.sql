-- Adds the owner's Customer/Vendor/Product/Manufacturer/User master-data
-- fields (Master value.xlsx) as additive, nullable columns. No existing
-- column is renamed, retyped, or dropped; every existing row remains valid
-- with no backfill required. Settings-driven LOV fields are stored as plain
-- TEXT and validated server-side against the existing "settings" table --
-- they intentionally have no DB-level FK/enum, matching how Category and
-- Setting values already work in this schema.

-- AlterTable: users
ALTER TABLE "users" ADD COLUMN "screen_name" TEXT;
ALTER TABLE "users" ADD COLUMN "organization_id" UUID;
ALTER TABLE "users" ADD COLUMN "position" TEXT;
ALTER TABLE "users" ADD COLUMN "department" TEXT;
ALTER TABLE "users" ADD COLUMN "mobile" TEXT;
ALTER TABLE "users" ADD COLUMN "address" TEXT;
ALTER TABLE "users" ADD COLUMN "skype" TEXT;

CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: companies (Customer Master)
ALTER TABLE "companies" ADD COLUMN "short_name" TEXT;
ALTER TABLE "companies" ADD COLUMN "bill_to_address" TEXT;
ALTER TABLE "companies" ADD COLUMN "ship_to_address" TEXT;
ALTER TABLE "companies" ADD COLUMN "additional_ship_to_addresses" JSONB;
ALTER TABLE "companies" ADD COLUMN "state" TEXT;
ALTER TABLE "companies" ADD COLUMN "country" TEXT;
ALTER TABLE "companies" ADD COLUMN "relationship_type" TEXT;
ALTER TABLE "companies" ADD COLUMN "customer_type" TEXT;
ALTER TABLE "companies" ADD COLUMN "website" TEXT;
ALTER TABLE "companies" ADD COLUMN "fax" TEXT;
ALTER TABLE "companies" ADD COLUMN "primary_contact" TEXT;
ALTER TABLE "companies" ADD COLUMN "contact_email" TEXT;
ALTER TABLE "companies" ADD COLUMN "authorised_person" TEXT;
ALTER TABLE "companies" ADD COLUMN "payment_terms" TEXT;
ALTER TABLE "companies" ADD COLUMN "credit_limit" DECIMAL(18,2);
ALTER TABLE "companies" ADD COLUMN "region" TEXT;
ALTER TABLE "companies" ADD COLUMN "sales_person_id" UUID;
ALTER TABLE "companies" ADD COLUMN "sales_coordinator_id" UUID;
ALTER TABLE "companies" ADD COLUMN "sourcing_owner_id" UUID;
ALTER TABLE "companies" ADD COLUMN "internal_account_number" TEXT;
ALTER TABLE "companies" ADD COLUMN "shipping_account" TEXT;
ALTER TABLE "companies" ADD COLUMN "bank_details" TEXT;
ALTER TABLE "companies" ADD COLUMN "industry_segment" TEXT;
ALTER TABLE "companies" ADD COLUMN "remarks" TEXT;
ALTER TABLE "companies" ADD COLUMN "contacts" JSONB;
ALTER TABLE "companies" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "companies_sales_person_id_idx" ON "companies"("sales_person_id");
CREATE INDEX "companies_sales_coordinator_id_idx" ON "companies"("sales_coordinator_id");
CREATE INDEX "companies_sourcing_owner_id_idx" ON "companies"("sourcing_owner_id");

ALTER TABLE "companies" ADD CONSTRAINT "companies_sales_person_id_fkey" FOREIGN KEY ("sales_person_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_sales_coordinator_id_fkey" FOREIGN KEY ("sales_coordinator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_sourcing_owner_id_fkey" FOREIGN KEY ("sourcing_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: vendors (Vendor Master)
ALTER TABLE "vendors" ADD COLUMN "contact_name" TEXT;
ALTER TABLE "vendors" ADD COLUMN "vendor_code" TEXT;
ALTER TABLE "vendors" ADD COLUMN "bill_to_address" TEXT;
ALTER TABLE "vendors" ADD COLUMN "ship_to_address" TEXT;
ALTER TABLE "vendors" ADD COLUMN "country" TEXT;
ALTER TABLE "vendors" ADD COLUMN "telephone" TEXT;
ALTER TABLE "vendors" ADD COLUMN "fax" TEXT;
ALTER TABLE "vendors" ADD COLUMN "mobile" TEXT;
ALTER TABLE "vendors" ADD COLUMN "website" TEXT;
ALTER TABLE "vendors" ADD COLUMN "other_offices" TEXT;
ALTER TABLE "vendors" ADD COLUMN "mov" DECIMAL(18,2);
ALTER TABLE "vendors" ADD COLUMN "payment_currency" TEXT;
ALTER TABLE "vendors" ADD COLUMN "payment_terms" TEXT;
ALTER TABLE "vendors" ADD COLUMN "shipping_account" TEXT;
ALTER TABLE "vendors" ADD COLUMN "bank_details" TEXT;
ALTER TABLE "vendors" ADD COLUMN "credit_limit" DECIMAL(18,2);
ALTER TABLE "vendors" ADD COLUMN "industry_segment" TEXT;
ALTER TABLE "vendors" ADD COLUMN "business_type" TEXT;
ALTER TABLE "vendors" ADD COLUMN "speciality" TEXT;
ALTER TABLE "vendors" ADD COLUMN "gst_or_registration_number" TEXT;
ALTER TABLE "vendors" ADD COLUMN "contacts" JSONB;
ALTER TABLE "vendors" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "vendors_vendor_code_key" ON "vendors"("vendor_code");

-- AlterTable: manufacturers (Manufacturer Master)
ALTER TABLE "manufacturers" ADD COLUMN "distributor_link" TEXT;
ALTER TABLE "manufacturers" ADD COLUMN "stock_check_link" TEXT;
ALTER TABLE "manufacturers" ADD COLUMN "acquired_mfr" TEXT;
ALTER TABLE "manufacturers" ADD COLUMN "remarks" TEXT;
ALTER TABLE "manufacturers" ADD COLUMN "suffix_information" TEXT;
ALTER TABLE "manufacturers" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: settings (adds active/inactive support -- deactivating a
-- value hides it from future dropdowns without deleting it, so any existing
-- record that already stored it keeps displaying correctly)
ALTER TABLE "settings" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: products (Product Master)
ALTER TABLE "products" ADD COLUMN "product_code" TEXT;
ALTER TABLE "products" ADD COLUMN "spq" INTEGER;
ALTER TABLE "products" ADD COLUMN "packaging" TEXT;
ALTER TABLE "products" ADD COLUMN "uom" TEXT;
ALTER TABLE "products" ADD COLUMN "hs_code" TEXT;
ALTER TABLE "products" ADD COLUMN "hs_description" TEXT;
ALTER TABLE "products" ADD COLUMN "product_group" TEXT;
ALTER TABLE "products" ADD COLUMN "eccn" TEXT;
ALTER TABLE "products" ADD COLUMN "available_stock" INTEGER;
