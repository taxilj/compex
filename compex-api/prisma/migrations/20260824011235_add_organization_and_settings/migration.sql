-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "contact_person" TEXT,
    "ff_account" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "company_registration_no" TEXT,
    "invoice_prefix" TEXT,
    "proforma_invoice_prefix" TEXT,
    "packing_slip_prefix" TEXT,
    "coc_prefix" TEXT,
    "order_ack_prefix" TEXT,
    "quotation_prefix" TEXT,
    "sales_order_prefix" TEXT,
    "purchase_order_prefix" TEXT,
    "item_no_prefix" TEXT,
    "vendor_code_prefix" TEXT,
    "customer_code_prefix" TEXT,
    "contact_code_prefix" TEXT,
    "location" TEXT,
    "rma_prefix" TEXT,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "bank_address" TEXT,
    "swift_ifsc_micr" TEXT,
    "routing_code" TEXT,
    "signature_url" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE UNIQUE INDEX "settings_category_value_key" ON "settings"("category", "value");
