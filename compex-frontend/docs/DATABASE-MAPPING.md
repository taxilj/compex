# Database Mapping

## Existing Database

**MISSING — no database exists.** All data is currently stored in Excel files:
- `D:\RFQLog (23).xlsx` — RFQ tracking
- `D:\KAS CRM.xlsx` — Customer/contact CRM

The schema below is derived entirely from the Stitch design mockups and represents what must be built.

**Schema inventory: 18 tables fully designed + 1 planned (payments, Phase 5).**

---

## Proposed Schema (PostgreSQL)

All tables include `created_at TIMESTAMPTZ DEFAULT now()` and `updated_at TIMESTAMPTZ DEFAULT now()` unless noted.

---

### users

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | bcrypt |
| role | TEXT NOT NULL | `admin` \| `staff` \| `customer` |
| first_name | TEXT | |
| last_name | TEXT | |
| phone | TEXT | |
| is_active | BOOLEAN DEFAULT true | |
| last_login_at | TIMESTAMPTZ | |

---

### companies

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| gst_number | TEXT | |
| pan_number | TEXT | |
| address_line1 | TEXT | |
| address_line2 | TEXT | |
| city | TEXT | |
| state | TEXT | |
| country | TEXT DEFAULT 'India' | |
| pincode | TEXT | |
| industry | TEXT | |

---

### customers

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | tenant identifier |
| user_id | UUID FK → users | portal login |
| company_id | UUID FK → companies | |
| account_number | TEXT UNIQUE | human-readable ID |
| credit_limit_inr | NUMERIC(15,2) | |
| payment_terms_days | INTEGER DEFAULT 30 | |
| assigned_sales_staff_id | UUID FK → users | |

> **Tenant isolation key:** All customer-owned records join on `customer_id`. Row-Level Security (RLS) policies enforce that `customer_id = current_setting('app.customer_id')`.

---

### vendors

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| country | TEXT | |
| city | TEXT | |
| categories | TEXT[] | e.g. `{MCU, Power, Passive}` |
| response_rate_pct | NUMERIC(5,2) | 0–100 |
| avg_lead_time_days | INTEGER | |
| status | TEXT | `active` \| `watchlist` \| `inactive` |
| payment_terms | TEXT | |
| currency | TEXT DEFAULT 'USD' | |
| contact_name | TEXT | |
| contact_email | TEXT | |
| contact_phone | TEXT | |

---

### manufacturers

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| short_name | TEXT | e.g. `STM`, `TI` |
| country | TEXT | |
| website | TEXT | |
| authorized_distributor_ids | UUID[] | FK → vendors |

---

### products

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| mpn | TEXT NOT NULL | Manufacturer Part Number |
| manufacturer_id | UUID FK → manufacturers | |
| description | TEXT | |
| category | TEXT | |
| package | TEXT | e.g. `LQFP-48` |
| datasheet_url | TEXT | |
| rohs_compliant | BOOLEAN | |
| lifecycle_status | TEXT | `active` \| `nrnd` \| `obsolete` |

---

### rfqs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| rfq_number | TEXT UNIQUE NOT NULL | e.g. `RFQ-10452` |
| customer_id | UUID FK → customers | **tenant key** |
| status | TEXT NOT NULL | `new` \| `sourcing` \| `vendor_response` \| `quote_prep` \| `quote_ready` \| `approved` \| `closed` \| `cancelled` |
| priority | TEXT | `high` \| `medium` \| `low` |
| required_date | DATE | |
| delivery_location | TEXT | |
| assigned_to_id | UUID FK → users | internal staff |
| estimated_value_inr | NUMERIC(15,2) | |
| notes | TEXT | |
| submitted_at | TIMESTAMPTZ | |

---

### rfq_items (BOM lines)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| rfq_id | UUID FK → rfqs | |
| line_number | INTEGER NOT NULL | |
| mpn | TEXT NOT NULL | |
| manufacturer_id | UUID FK → manufacturers | nullable |
| description | TEXT | |
| quantity | INTEGER NOT NULL | |
| target_price_usd | NUMERIC(10,4) | |
| status | TEXT | `pending` \| `sourced` \| `review_required` \| `not_found` |
| sourced_product_id | UUID FK → products | nullable |

---

### vendor_rfqs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| rfq_id | UUID FK → rfqs | |
| vendor_id | UUID FK → vendors | |
| sent_at | TIMESTAMPTZ | |
| response_deadline | DATE | |
| status | TEXT | `sent` \| `responded` \| `no_response` \| `declined` |

---

### vendor_quotes

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| vendor_rfq_id | UUID FK → vendor_rfqs | |
| rfq_item_id | UUID FK → rfq_items | |
| unit_price_usd | NUMERIC(10,4) NOT NULL | |
| moq | INTEGER | Minimum Order Quantity |
| lead_time_days | INTEGER | |
| incoterms | TEXT | e.g. `FOB`, `CIF` |
| validity_date | DATE | |
| notes | TEXT | |

---

### costings

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| rfq_id | UUID FK → rfqs | |
| rfq_item_id | UUID FK → rfq_items | |
| vendor_quote_id | UUID FK → vendor_quotes | selected quote |
| exchange_rate_usd_inr | NUMERIC(10,4) NOT NULL | at time of costing |
| freight_usd | NUMERIC(10,2) | |
| insurance_pct | NUMERIC(5,2) | |
| duty_rate_pct | NUMERIC(5,2) | |
| hsn_code | TEXT | |
| base_material_cost_inr | NUMERIC(15,2) | computed |
| landed_cost_inr | NUMERIC(15,2) | computed |
| compex_margin_pct | NUMERIC(5,2) | INTERNAL — never expose to customer |
| customer_price_inr | NUMERIC(15,2) | computed, shown to customer |
| costed_at | TIMESTAMPTZ | |
| costed_by_id | UUID FK → users | |

---

### quotations

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| quote_number | TEXT UNIQUE | e.g. `QT-10452-1` |
| rfq_id | UUID FK → rfqs | |
| customer_id | UUID FK → customers | **tenant key** |
| status | TEXT | `draft` \| `sent` \| `accepted` \| `rejected` \| `expired` |
| valid_until | DATE | |
| total_inr | NUMERIC(15,2) | |
| payment_terms | TEXT | |
| delivery_location | TEXT | |
| sent_at | TIMESTAMPTZ | |

---

### quotation_items

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| quotation_id | UUID FK → quotations | |
| rfq_item_id | UUID FK → rfq_items | |
| unit_price_inr | NUMERIC(10,2) | |
| quantity | INTEGER | |
| line_total_inr | NUMERIC(15,2) | |

---

### sales_orders

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| order_number | TEXT UNIQUE | e.g. `SO-10452` |
| customer_id | UUID FK → customers | **tenant key** |
| quotation_id | UUID FK → quotations | |
| status | TEXT | `confirmed` \| `processing` \| `dispatched` \| `delivered` \| `cancelled` |
| confirmed_at | TIMESTAMPTZ | |
| total_inr | NUMERIC(15,2) | |

---

### purchase_orders

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| po_number | TEXT UNIQUE | e.g. `PO-10452` |
| sales_order_id | UUID FK → sales_orders | |
| vendor_id | UUID FK → vendors | |
| status | TEXT | `draft` \| `sent` \| `confirmed` \| `shipped` \| `received` \| `cancelled` |
| total_usd | NUMERIC(15,2) | |
| sent_at | TIMESTAMPTZ | |

---

### shipments

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tracking_number | TEXT | |
| sales_order_id | UUID FK → sales_orders | |
| customer_id | UUID FK → customers | **tenant key** |
| status | TEXT | `in_transit` \| `in_customs` \| `arrived_india` \| `dispatched` \| `delivered` |
| carrier | TEXT | |
| origin_country | TEXT | |
| estimated_arrival | DATE | |
| actual_arrival | DATE | |
| customs_entry_number | TEXT | |
| awb_number | TEXT | Air Waybill |

---

### invoices

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| invoice_number | TEXT UNIQUE | |
| customer_id | UUID FK → customers | **tenant key** |
| sales_order_id | UUID FK → sales_orders | |
| status | TEXT | `draft` \| `sent` \| `paid` \| `overdue` \| `cancelled` |
| due_date | DATE | |
| total_inr | NUMERIC(15,2) | |
| paid_at | TIMESTAMPTZ | |
| payment_reference | TEXT | |

---

### documents

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| customer_id | UUID FK → customers | **tenant key** (nullable for internal) |
| entity_type | TEXT | `rfq` \| `quotation` \| `sales_order` \| `shipment` \| `invoice` |
| entity_id | UUID | polymorphic FK |
| document_type | TEXT | `bom` \| `datasheet` \| `commercial_invoice` \| `packing_list` \| `awb` \| `custom_doc` |
| file_name | TEXT NOT NULL | |
| storage_key | TEXT NOT NULL | S3/R2 key — NEVER expose directly |
| mime_type | TEXT | |
| file_size_bytes | INTEGER | |
| uploaded_by_id | UUID FK → users | |

---

### audit_logs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | who |
| customer_id | UUID | if customer action |
| action | TEXT | e.g. `rfq.created`, `quotation.sent` |
| entity_type | TEXT | |
| entity_id | UUID | |
| old_value | JSONB | before state |
| new_value | JSONB | after state |
| ip_address | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT now() | no updated_at |

---


### payments *(Phase 5 — not yet implemented)*

The RFQ workflow (RFQ-WORKFLOW.md Step 11) documents payment collection after invoicing. A `payments` table is required but deferred to Phase 5.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| invoice_id | UUID FK → invoices | |
| customer_id | UUID FK → customers | **tenant key** |
| amount_inr | NUMERIC(15,2) NOT NULL | |
| payment_method | TEXT | `neft` \| `rtgs` \| `cheque` \| `upi` |
| reference_number | TEXT | Bank/payment reference |
| paid_at | TIMESTAMPTZ NOT NULL | |
| recorded_by_id | UUID FK → users | staff who recorded |
| notes | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

---
## Tenant Isolation Enforcement

Every table with a `customer_id` column must have a PostgreSQL Row-Level Security policy:

```sql
-- Enable RLS
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;

-- Customer can only see their own rows
CREATE POLICY customer_isolation ON rfqs
  USING (customer_id = current_setting('app.customer_id')::uuid);

-- Staff/admin bypass
CREATE POLICY staff_all ON rfqs
  USING (current_setting('app.role') IN ('admin', 'staff'));
```

The application sets `app.customer_id` and `app.role` per request in a transaction-scoped SET LOCAL.

---

## Indexes (Critical)

```sql
CREATE INDEX idx_rfqs_customer_id ON rfqs(customer_id);
CREATE INDEX idx_rfqs_status ON rfqs(status);
CREATE INDEX idx_rfq_items_rfq_id ON rfq_items(rfq_id);
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_products_mpn ON products(mpn);
```