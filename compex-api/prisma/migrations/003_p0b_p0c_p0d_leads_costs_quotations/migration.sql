-- Migration 003: P0-B/C/D — Leads, Landed Cost, Quotations, Follow-ups
-- Additive only — no existing tables modified destructively.

-- Enums

CREATE TYPE "LeadSource" AS ENUM (
  'GOOGLE_ORGANIC', 'GOOGLE_ADS', 'LINKEDIN', 'WHATSAPP',
  'EMAIL', 'DIRECT', 'REFERRAL', 'OTHER'
);

CREATE TYPE "LeadStatus" AS ENUM (
  'NEW', 'CONTACTED', 'QUALIFIED', 'QUOTATION', 'WON', 'LOST'
);

CREATE TYPE "QuotationStatus" AS ENUM (
  'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'
);

CREATE TYPE "FollowUpType" AS ENUM ('DAY_1', 'DAY_3', 'DAY_7', 'DAY_14');

CREATE TYPE "FollowUpStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED');

-- Sequence for quotation numbers (concurrency-safe)
CREATE SEQUENCE IF NOT EXISTS quotation_counter_seq START 1;

-- leads
CREATE TABLE leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID REFERENCES customers(id),
  rfq_id            UUID UNIQUE REFERENCES rfqs(id),
  contact_name      TEXT NOT NULL,
  contact_email     TEXT NOT NULL,
  contact_phone     TEXT,
  company_name      TEXT NOT NULL,
  source            "LeadSource" NOT NULL DEFAULT 'DIRECT',
  status            "LeadStatus" NOT NULL DEFAULT 'NEW',
  priority          "RFQPriority" NOT NULL DEFAULT 'MEDIUM',
  assigned_to_id    UUID REFERENCES users(id),
  last_contact_at   TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- landed_costs
CREATE TABLE landed_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_rfq_id   UUID UNIQUE NOT NULL REFERENCES vendor_rfqs(id),
  vendor_quote_id UUID REFERENCES vendor_quotes(id),
  currency        TEXT NOT NULL DEFAULT 'INR',
  exchange_rate   NUMERIC(18, 6) NOT NULL DEFAULT 1,
  quantity        INTEGER NOT NULL,
  shipping        NUMERIC(18, 4) NOT NULL DEFAULT 0,
  insurance       NUMERIC(18, 4) NOT NULL DEFAULT 0,
  customs_duty    NUMERIC(18, 4) NOT NULL DEFAULT 0,
  igst            NUMERIC(18, 4) NOT NULL DEFAULT 0,
  handling        NUMERIC(18, 4) NOT NULL DEFAULT 0,
  other_costs     NUMERIC(18, 4) NOT NULL DEFAULT 0,
  margin_percent  NUMERIC(8, 4) NOT NULL DEFAULT 0,
  product_cost    NUMERIC(18, 4) NOT NULL,
  landed_cost     NUMERIC(18, 4) NOT NULL,
  customer_price  NUMERIC(18, 4) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quotations
CREATE TABLE quotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT UNIQUE NOT NULL,
  rfq_id           UUID NOT NULL REFERENCES rfqs(id),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  landed_cost_id   UUID REFERENCES landed_costs(id),
  status           "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
  currency         TEXT NOT NULL DEFAULT 'INR',
  subtotal         NUMERIC(18, 4) NOT NULL,
  tax              NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total            NUMERIC(18, 4) NOT NULL,
  valid_until      DATE NOT NULL,
  notes            TEXT,
  delivery_terms   TEXT,
  payment_terms    TEXT,
  pdf_storage_key  TEXT,
  sent_at          TIMESTAMPTZ,
  viewed_at        TIMESTAMPTZ,
  responded_at     TIMESTAMPTZ,
  created_by_id    UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quotation_items
CREATE TABLE quotation_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  rfq_item_id  UUID REFERENCES rfq_items(id),
  line_number  INTEGER NOT NULL,
  mpn          TEXT NOT NULL,
  manufacturer TEXT,
  description  TEXT,
  quantity     INTEGER NOT NULL,
  unit_price   NUMERIC(18, 4) NOT NULL,
  tax_rate     NUMERIC(8, 4) NOT NULL DEFAULT 0,
  tax_amount   NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_total   NUMERIC(18, 4) NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- follow_ups
CREATE TABLE follow_ups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID REFERENCES leads(id),
  rfq_id         UUID REFERENCES rfqs(id),
  quotation_id   UUID REFERENCES quotations(id),
  type           "FollowUpType" NOT NULL,
  status         "FollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
  attempt        INTEGER NOT NULL DEFAULT 1,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  sent_at        TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
