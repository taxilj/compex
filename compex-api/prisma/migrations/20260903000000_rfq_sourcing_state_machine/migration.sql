-- Additive, internal-only sourcing workflow. Existing RFQs stay NULL so no
-- historic customer-facing status is silently reinterpreted.
CREATE TYPE "SourcingStatus" AS ENUM (
  'NEW',
  'REVIEWING',
  'SOURCING',
  'SUPPLIER_QUOTES_PENDING',
  'SUPPLIER_QUOTES_RECEIVED',
  'COMPARE',
  'CUSTOMER_QUOTE_READY',
  'QUOTE_SENT',
  'ACCEPTED',
  'REJECTED',
  'ORDER_PROCUREMENT'
);

ALTER TABLE "rfqs" ADD COLUMN "sourcing_status" "SourcingStatus";
CREATE INDEX "rfqs_sourcing_status_idx" ON "rfqs"("sourcing_status");
