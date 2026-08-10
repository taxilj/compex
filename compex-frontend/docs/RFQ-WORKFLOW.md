# RFQ Workflow

## Overview

This document traces the complete RFQ lifecycle from customer submission to invoice payment. All steps are derived from the Stitch design mockups. No backend currently implements any of this.

---

## Workflow Diagram

```
Customer submits BOM / part list
         │
         ▼
    [rfqs] row created — status: new
         │
         ▼ Staff reviews + assigns
    status: sourcing
         │
         ▼ Staff sends enquiry to vendors
    [vendor_rfqs] rows created — status: sent
         │
         ▼ Vendors respond with pricing
    [vendor_quotes] rows created
    status: vendor_response
         │
         ▼ Staff selects best quotes, calculates landed cost
    [costings] rows created
    status: quote_prep
         │
         ▼ Staff generates customer quotation
    [quotations] row created — status: draft → sent
    status: quote_ready
         │
         ▼ Customer reviews + accepts quote
    quotation status: accepted
    rfq status: approved
         │
         ▼ Sales order created
    [sales_orders] row — status: confirmed
         │
         ▼ Purchase orders raised with vendors
    [purchase_orders] rows — status: sent
         │
         ▼ Goods shipped by vendor
    purchase_order status: shipped
         │
         ▼ Import / customs clearance
    [shipments] row — status: in_transit → in_customs → arrived_india
         │
         ▼ Goods received + dispatched to customer
    shipment status: dispatched → delivered
    sales_order status: delivered
         │
         ▼ Invoice raised
    [invoices] row — status: sent
         │
         ▼ Customer pays
    invoice status: paid
```

---

## Step-by-Step Detail

### Step 1: Customer Submits RFQ

**Actor:** Customer (portal)
**Trigger:** Customer uploads BOM file (XLSX/CSV) or enters part numbers manually

**Actions:**
1. BOM file uploaded to document storage
2. Background job parses BOM → creates `rfq_items` rows
3. `rfqs` row created with status `new`
4. Notification sent to assigned sales staff

**Business Rules:**
- BOM must have at minimum: MPN and Quantity columns
- Unknown columns are mapped via a configurable column mapper
- Duplicate MPNs on same RFQ are flagged (not blocked)
- `rfq_number` auto-generated: `RFQ-{YYYYMMDD}-{sequence}`

**Tables Touched:** `rfqs`, `rfq_items`, `documents`
**Status After:** `new`

---

### Step 2: RFQ Review + Assignment

**Actor:** Admin/Staff
**Trigger:** Staff picks up new RFQ from dashboard queue

**Actions:**
1. Staff reviews BOM line items
2. Assigns priority (High/Medium/Low)
3. Assigns to specific buyer (self or colleague)
4. Staff may manually correct MPNs or manufacturer
5. Status changed to `sourcing`

**Business Rules:**
- Priority defaults to `medium`
- High-priority RFQs appear at top of queue
- Required delivery date set here if not provided by customer

**Tables Touched:** `rfqs` (update), `rfq_items` (correction)
**Status After:** `sourcing`

---

### Step 3: Supplier Sourcing

**Actor:** Staff (Buyer)
**Trigger:** Status is `sourcing`

**Actions:**
1. Staff searches for each BOM line item:
   - Phase 2: via Mouser / DigiKey / element14 API
   - Phase 1: manual lookup, enter quote data manually
2. For each line item, one or more vendor quotes captured
3. `vendor_rfqs` created (one per vendor contacted)
4. `vendor_quotes` created as responses arrive

**Business Rules:**
- Minimum 2 vendor quotes required before proceeding (configurable)
- Line items with no quotes must be marked `not_found` before proceeding
- Exchange rate (USD → INR) captured at time of first vendor response

**Tables Touched:** `vendor_rfqs`, `vendor_quotes`, `rfq_items` (status update)
**Status After:** `vendor_response`

---

### Step 4: Costing (Landed Cost Calculation)

**Actor:** Staff (Costing Team)
**Trigger:** All BOM items have at least one vendor quote

**Landed Cost Formula (per line item):**
```
base_material_cost_inr = unit_price_usd × quantity × exchange_rate_usd_inr
freight_allocated_inr  = (freight_usd × line_weight_pct) × exchange_rate_usd_inr
insurance_inr          = base_material_cost_inr × (insurance_pct / 100)
customs_duty_inr       = (base_material_cost_inr + freight_allocated_inr) × (duty_rate_pct / 100)

landed_cost_inr        = base_material_cost_inr + freight_allocated_inr + insurance_inr + customs_duty_inr

customer_price_inr     = landed_cost_inr × (1 + compex_margin_pct / 100)
```

**SECURITY:** `compex_margin_pct` and `landed_cost_inr` are INTERNAL fields. They must NEVER appear in any customer-facing API response. The `customer_price_inr` column is the only price visible to customers.

**Tables Touched:** `costings`
**Status After:** `quote_prep`

---

### Step 5: Customer Quotation

**Actor:** Staff
**Trigger:** All line items costed, pricing approved by management

**Actions:**
1. Staff generates quotation from costings
2. `quotations` and `quotation_items` rows created
3. PDF quotation generated and stored in documents
4. Customer notified via email + portal notification
5. RFQ status → `quote_ready`

**Business Rules:**
- Quotation validity period: 7 days (configurable per RFQ)
- Customer cannot see internal margin or landed cost breakdown
- If validity expires, re-costing required before re-issuing

**Tables Touched:** `quotations`, `quotation_items`, `documents`
**Status After:** `quote_ready`

---

### Step 6: Customer Approval

**Actor:** Customer (portal)
**Trigger:** Customer receives quotation notification

**Actions:**
1. Customer reviews quotation in portal
2. Customer accepts or rejects
3. If accepted: RFQ status → `approved`, quotation status → `accepted`
4. If rejected: Staff notified, RFQ may be re-quoted or closed

**Tables Touched:** `quotations` (status), `rfqs` (status)
**Status After:** `approved`

---

### Step 7: Sales Order

**Actor:** Staff (auto-triggered on acceptance)

**Actions:**
1. `sales_orders` row created from approved quotation
2. `order_number` assigned: `SO-{rfq_number_seq}`
3. Customer notified of order confirmation
4. Advance payment request sent if required

**Tables Touched:** `sales_orders`
**Status After (sales_order):** `confirmed`

---

### Step 8: Purchase Orders

**Actor:** Staff (Procurement)

**Actions:**
1. One or more `purchase_orders` raised — one per vendor in the BOM
2. POs sent to vendors via email
3. Vendor acknowledges PO

**Tables Touched:** `purchase_orders`
**Status After (purchase_order):** `sent` → `confirmed`

---

### Step 9: Import & Logistics

**Actor:** Staff (Logistics)

**Actions:**
1. Goods shipped by vendor; AWB / tracking number recorded
2. `shipments` row created
3. Status progression: `in_transit` → `in_customs` → `arrived_india`
4. Customs documentation uploaded (commercial invoice, packing list, AWB)
5. Customs duty paid; goods cleared

**Tables Touched:** `shipments`, `documents`
**Status After (shipment):** `arrived_india`

---

### Step 10: Dispatch to Customer

**Actor:** Staff (Logistics)

**Actions:**
1. Goods received at Compex warehouse, inspected
2. Packed and dispatched to customer
3. Shipment status → `dispatched` → `delivered`
4. Delivery confirmed (POD uploaded)

**Tables Touched:** `shipments` (status), `sales_orders` (status → `delivered`)
**Status After (shipment):** `delivered`

---

### Step 11: Invoice & Payment

**Actor:** Staff (Finance)

**Actions:**
1. `invoices` row created referencing sales order
2. Invoice PDF generated and emailed to customer
3. Customer pays (NEFT / RTGS / cheque)
4. Payment reference recorded; invoice marked `paid`

**Tables Touched:** `invoices` (status → `paid`)
**Status After:** `paid`

---

## Status Reference

### RFQ Statuses
| Status | Meaning |
|--------|---------|
| `new` | Submitted, not yet reviewed |
| `sourcing` | Assigned; buyer searching suppliers |
| `vendor_response` | Supplier quotes received |
| `quote_prep` | Costing in progress |
| `quote_ready` | Quotation sent to customer |
| `approved` | Customer accepted quote |
| `closed` | Order complete |
| `cancelled` | Cancelled at any stage |

### What Is MISSING (must be built from scratch)

| Step | Controller | Service | DB Table | Status |
|------|-----------|---------|----------|--------|
| All | MISSING | MISSING | MISSING (designed above) | MISSING |