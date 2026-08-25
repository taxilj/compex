-- Additive website-enquiry intake fields. Existing leads remain intact.

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CONTACT';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'REQUEST_QUOTE';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'BOM';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CUSTOMER_PORTAL';

CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE SEQUENCE IF NOT EXISTS enquiry_counter_seq START 1;

ALTER TABLE leads
  ADD COLUMN reference_number TEXT,
  ADD COLUMN idempotency_key TEXT,
  ADD COLUMN subject TEXT,
  ADD COLUMN delivery_location TEXT,
  ADD COLUMN required_date DATE,
  ADD COLUMN notification_status "NotificationStatus",
  ADD COLUMN notification_sent_at TIMESTAMPTZ,
  ADD COLUMN notification_error TEXT,
  ADD COLUMN notification_message_id TEXT;

CREATE UNIQUE INDEX leads_reference_number_key ON leads(reference_number);
CREATE UNIQUE INDEX leads_idempotency_key_key ON leads(idempotency_key);

CREATE TABLE lead_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  mpn TEXT NOT NULL,
  manufacturer TEXT,
  description TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, line_number)
);
