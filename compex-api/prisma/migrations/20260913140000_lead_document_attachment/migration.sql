-- Adds an optional lead_id owner to documents, so a public website BOM
-- enquiry (Lead) can have a securely stored, durable document attached to
-- it -- exactly like the existing optional customer_id/rfq_id owners used
-- by the authenticated portal RFQ BOM upload flow. Mutually exclusive with
-- customer_id/rfq_id in application logic; kept isolated at the database
-- level only by convention (enforced in the upload handler), matching how
-- customer_id/rfq_id are already handled.
--
-- Safe/additive: nullable column, no backfill needed. Every existing
-- document row has customer_id/rfq_id set and simply leaves lead_id NULL.

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "lead_id" UUID;

-- CreateIndex
CREATE INDEX "documents_lead_id_idx" ON "documents"("lead_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
