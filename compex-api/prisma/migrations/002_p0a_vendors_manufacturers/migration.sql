-- Sequence for vendor RFQ numbers
CREATE SEQUENCE IF NOT EXISTS vendor_rfq_counter_seq START 1;

-- CreateEnum
CREATE TYPE "VendorRfqStatus" AS ENUM ('DRAFT', 'SENT', 'REPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VendorQuoteStatus" AS ENUM ('RECEIVED', 'SELECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_rfqs" (
    "id" UUID NOT NULL,
    "vendor_rfq_number" TEXT NOT NULL,
    "rfq_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" "VendorRfqStatus" NOT NULL DEFAULT 'DRAFT',
    "email_sent_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_rfq_items" (
    "id" UUID NOT NULL,
    "vendor_rfq_id" UUID NOT NULL,
    "rfq_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "vendor_rfq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_quotes" (
    "id" UUID NOT NULL,
    "vendor_rfq_id" UUID NOT NULL,
    "rfq_item_id" UUID NOT NULL,
    "status" "VendorQuoteStatus" NOT NULL DEFAULT 'RECEIVED',
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lead_time_days" INTEGER,
    "moq" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_slug_key" ON "manufacturers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_rfqs_vendor_rfq_number_key" ON "vendor_rfqs"("vendor_rfq_number");

-- AddForeignKey
ALTER TABLE "vendor_rfqs" ADD CONSTRAINT "vendor_rfqs_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_rfqs" ADD CONSTRAINT "vendor_rfqs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_rfq_items" ADD CONSTRAINT "vendor_rfq_items_vendor_rfq_id_fkey" FOREIGN KEY ("vendor_rfq_id") REFERENCES "vendor_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_rfq_items" ADD CONSTRAINT "vendor_rfq_items_rfq_item_id_fkey" FOREIGN KEY ("rfq_item_id") REFERENCES "rfq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_vendor_rfq_id_fkey" FOREIGN KEY ("vendor_rfq_id") REFERENCES "vendor_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_rfq_item_id_fkey" FOREIGN KEY ("rfq_item_id") REFERENCES "rfq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
