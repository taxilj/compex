-- Downstream procurement workflow: quotation acceptance -> sales order ->
-- purchase order -> shipment -> invoice. All numbers use database sequences
-- so concurrent requests cannot allocate duplicate human-readable numbers.
CREATE SEQUENCE IF NOT EXISTS sales_order_counter_seq START 1;
CREATE SEQUENCE IF NOT EXISTS purchase_order_counter_seq START 1;
CREATE SEQUENCE IF NOT EXISTS shipment_counter_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_counter_seq START 1;

CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "ShipmentStatus" AS ENUM ('PROCESSING', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "quotation_id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL,
    "delivery_address" TEXT,
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_order_items" (
    "id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "quotation_item_id" UUID,
    "line_number" INTEGER NOT NULL,
    "mpn" TEXT NOT NULL,
    "manufacturer" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "expected_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "sales_order_item_id" UUID,
    "vendor_quote_id" UUID,
    "line_number" INTEGER NOT NULL,
    "mpn" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "line_total" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "shipment_number" TEXT NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "purchase_order_id" UUID,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PROCESSING',
    "tracking_number" TEXT,
    "carrier" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "eta" DATE,
    "delivered_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL,
    "due_date" DATE,
    "issued_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "mpn" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");
CREATE UNIQUE INDEX "sales_orders_quotation_id_key" ON "sales_orders"("quotation_id");
CREATE UNIQUE INDEX "sales_order_items_sales_order_id_line_number_key" ON "sales_order_items"("sales_order_id", "line_number");
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_line_number_key" ON "purchase_order_items"("purchase_order_id", "line_number");
CREATE UNIQUE INDEX "shipments_shipment_number_key" ON "shipments"("shipment_number");
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE UNIQUE INDEX "invoice_items_invoice_id_line_number_key" ON "invoice_items"("invoice_id", "line_number");
CREATE INDEX "sales_orders_customer_id_created_at_idx" ON "sales_orders"("customer_id", "created_at");
CREATE INDEX "sales_orders_rfq_id_idx" ON "sales_orders"("rfq_id");
CREATE INDEX "sales_orders_status_created_at_idx" ON "sales_orders"("status", "created_at");
CREATE INDEX "sales_order_items_quotation_item_id_idx" ON "sales_order_items"("quotation_item_id");
CREATE INDEX "purchase_orders_sales_order_id_idx" ON "purchase_orders"("sales_order_id");
CREATE INDEX "purchase_orders_vendor_id_status_idx" ON "purchase_orders"("vendor_id", "status");
CREATE INDEX "purchase_order_items_sales_order_item_id_idx" ON "purchase_order_items"("sales_order_item_id");
CREATE INDEX "purchase_order_items_vendor_quote_id_idx" ON "purchase_order_items"("vendor_quote_id");
CREATE INDEX "shipments_sales_order_id_status_idx" ON "shipments"("sales_order_id", "status");
CREATE INDEX "shipments_purchase_order_id_idx" ON "shipments"("purchase_order_id");
CREATE INDEX "shipments_tracking_number_idx" ON "shipments"("tracking_number");
CREATE INDEX "invoices_customer_id_created_at_idx" ON "invoices"("customer_id", "created_at");
CREATE INDEX "invoices_sales_order_id_idx" ON "invoices"("sales_order_id");
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_quotation_item_id_fkey" FOREIGN KEY ("quotation_item_id") REFERENCES "quotation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_vendor_quote_id_fkey" FOREIGN KEY ("vendor_quote_id") REFERENCES "vendor_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
