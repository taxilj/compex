# Integration Gaps

## Summary

This document maps every frontend feature to the required backend, identifies what is missing, and provides a gap priority matrix.

**Baseline:** No backend exists. All gaps below are build-from-scratch items.

---

## Frontend → Backend Gap Table

| Frontend Feature | Page/Route | Required API Endpoint | DB Tables | Exists? | Priority |
|-----------------|-----------|----------------------|-----------|---------|----------|
| Homepage CTA | `/` | None (static) | — | ✓ Static | — |
| Product search | `/` hero search | `GET /products/search?q=` | `products`, `manufacturers` | MISSING | P2 |
| Request Quote form | `/request-quote` | `POST /rfqs` | `rfqs` | MISSING | P1 |
| Industry pages | `/industries` | None (static) | — | ✓ Static | — |
| Sourcing page | `/sourcing` | None (static) | — | ✓ Static | — |
| Manufacturers page | `/manufacturers` | None (static) | — | ✓ Static | — |
| Services page | `/services` | None (static) | — | ✓ Static | — |
| Contact form | `/contact` | `POST /contact` (email only, no DB) | — | MISSING | P3 |
| Customer registration | `/register` | `POST /auth/register` | `users`, `customers`, `companies` | MISSING | P1 |
| Customer login | `/login` | `POST /auth/login` | `users` | MISSING | P1 |
| Forgot password | `/forgot-password` | `POST /auth/forgot-password` | `email_verifications` | MISSING | P1 |
| **Customer Portal** | | | | | |
| Portal dashboard | `/portal/dashboard` | `GET /customers/me`, `GET /rfqs?limit=5&status=active` | `rfqs`, `quotations`, `invoices` | MISSING | P1 |
| New RFQ | `/portal/rfqs/new` | `POST /rfqs` | `rfqs` | MISSING | P1 |
| BOM upload | `/portal/rfqs/new` (BOM tab) | `POST /rfqs/:id/bom` | `rfq_items`, `documents` | MISSING | P1 |
| RFQ list | `/portal/rfqs` | `GET /rfqs` | `rfqs` | MISSING | P1 |
| RFQ detail | `/portal/rfqs/:id` | `GET /rfqs/:id`, `GET /rfqs/:id/items` | `rfqs`, `rfq_items` | MISSING | P1 |
| Quote list | `/portal/quotes` | `GET /quotes` | `quotations` | MISSING | P1 |
| Quote detail | `/portal/quotes/:id` | `GET /quotes/:id`, `GET /quotes/:id/items` | `quotations`, `quotation_items` | MISSING | P1 |
| Accept/reject quote | `/portal/quotes/:id` | `POST /quotes/:id/accept` | `quotations`, `rfqs` | MISSING | P1 |
| Quote PDF download | `/portal/quotes/:id` | `GET /quotes/:id/download` | `documents` | MISSING | P2 |
| Order list | `/portal/orders` | `GET /orders` | `sales_orders` | MISSING | P2 |
| Order detail | `/portal/orders/:id` | `GET /orders/:id` | `sales_orders`, `rfq_items` | MISSING | P2 |
| Shipment tracking | `/portal/shipments` | `GET /shipments` | `shipments` | MISSING | P2 |
| Shipment detail | `/portal/shipments/:id` | `GET /shipments/:id` | `shipments` | MISSING | P2 |
| Invoice list | `/portal/invoices` | `GET /invoices` | `invoices` | MISSING | P2 |
| Invoice detail | `/portal/invoices/:id` | `GET /invoices/:id` | `invoices`, `quotation_items` | MISSING | P2 |
| Invoice PDF download | `/portal/invoices/:id` | `GET /invoices/:id/download` | `documents` | MISSING | P2 |
| Company profile | `/portal/profile` | `GET /customers/me/company`, `PATCH /customers/me/company` | `companies`, `customers` | MISSING | P2 |
| **Admin ERP** | | | | | |
| Admin dashboard | `/admin/dashboard` | `GET /admin/stats` | multiple | MISSING | P2 |
| Admin RFQ list | `/admin/rfqs` | `GET /admin/rfqs` | `rfqs`, `customers` | MISSING | P1 |
| Admin RFQ detail | `/admin/rfqs/:id` | `GET /admin/rfqs/:id` (with internal costing) | all rfq tables | MISSING | P1 |
| BOM review | `/admin/rfqs/:id` BOM tab | `GET /admin/rfqs/:id/items`, `PATCH /admin/rfqs/:id/items/:itemId` | `rfq_items` | MISSING | P1 |
| Vendor sourcing | `/admin/rfqs/:id` Sourcing tab | `POST /admin/rfqs/:id/vendor-rfqs` | `vendor_rfqs` | MISSING | P1 |
| Record vendor quotes | `/admin/rfqs/:id` Quotes tab | `POST /admin/rfqs/:id/vendor-rfqs/:id/quotes` | `vendor_quotes` | MISSING | P1 |
| Costing / landed cost | `/admin/rfqs/:id` Costing tab | `POST /admin/rfqs/:id/costing` | `costings` | MISSING | P1 |
| Generate quotation | `/admin/rfqs/:id` | `POST /admin/rfqs/:id/quotation` | `quotations`, `quotation_items` | MISSING | P1 |
| Admin product list | `/admin/products` | `GET /admin/products` | `products` | MISSING | P3 |
| Admin product add | `/admin/products/new` | `POST /admin/products` | `products` | MISSING | P3 |
| Admin customer list | `/admin/customers` | `GET /admin/customers` | `customers`, `companies` | MISSING | P2 |
| Admin vendor list | `/admin/vendors` | `GET /admin/vendors` | `vendors` | MISSING | P1 |
| Admin vendor add | `/admin/vendors/new` | `POST /admin/vendors` | `vendors` | MISSING | P1 |
| Admin order list | `/admin/orders` | `GET /admin/orders` | `sales_orders` | MISSING | P2 |
| Admin purchase orders | `/admin/orders/:id` PO tab | `POST /admin/orders/:id/purchase-orders` | `purchase_orders` | MISSING | P2 |
| Admin shipments | `/admin/shipments` | `GET /admin/shipments`, `PATCH /admin/shipments/:id` | `shipments` | MISSING | P2 |
| Admin invoices | `/admin/invoices` | `GET /admin/invoices`, `POST /admin/orders/:id/invoice` | `invoices` | MISSING | P2 |
| Mouser search | Admin sourcing tab | `GET /admin/rfqs/:id/items/:itemId/source/mouser` | `vendor_quotes` | MISSING | P3 |
| DigiKey search | Admin sourcing tab | `GET /admin/rfqs/:id/items/:itemId/source/digikey` | `vendor_quotes` | MISSING | P3 |
| element14 search | Admin sourcing tab | `GET /admin/rfqs/:id/items/:itemId/source/element14` | `vendor_quotes` | MISSING | P3 |

---

## Priority Definitions

| Priority | Meaning | Target Phase |
|----------|---------|-------------|
| P1 | Core RFQ workflow — platform not functional without it | Phase 1–3 |
| P2 | Important operational feature — needed for production use | Phase 3–5 |
| P3 | Nice-to-have / automation — manual workaround exists | Phase 6–7 |

---

## Business Logic Missing

| Logic | Notes |
|-------|-------|
| BOM XLSX parser | Map arbitrary column headers to MPN/Qty; handle merged cells |
| Landed cost calculator | See RFQ-WORKFLOW.md Step 4 — formula documented |
| Quotation PDF generator | Branded PDF with line items, validity date, T&C |
| Invoice PDF generator | Branded PDF with GST breakdown (CGST/SGST/IGST) |
| Exchange rate lookup | USD → INR at time of costing; need RBI/fixer.io feed |
| RFQ number sequence | Auto-increment with year prefix: `RFQ-{YY}{MM}-{seq}` |
| Email notifications | New RFQ, quote ready, order confirmed, shipment update, invoice |
| HSN code lookup | Required for Indian customs duty calculation |
| GST calculation | CGST+SGST for domestic, IGST for interstate — on invoices |

---

## Infrastructure Missing

| Component | Notes |
|-----------|-------|
| Backend API server | Node.js/Fastify OR .NET Core Web API — not yet created |
| PostgreSQL database | Not provisioned |
| Redis | For sessions, rate limiting, BullMQ job queues |
| S3/R2 bucket | For BOM files, PDFs, shipping documents |
| Background job runner | BullMQ for BOM parsing, email, PDF generation |
| Email service | Resend or SendGrid — transactional email |
| PDF generation | Puppeteer (headless Chrome) or @react-pdf/renderer |
| Deployment | Hosting for API + DB (Railway, Render, AWS, Azure) |
| CI/CD | GitHub Actions or equivalent |

---

## Excel Migration (Current Ops → Platform)

The current Excel files must be migrated as a one-time data import:

| Excel File | Data | Migration Target |
|-----------|------|-----------------|
| `RFQLog (23).xlsx` | Historic RFQ records | `rfqs` table (historical, read-only) |
| `KAS CRM.xlsx` | Customer contacts | `companies` + `customers` + `users` tables |

Migration approach:
1. Export Excel to CSV
2. Write one-time Node.js migration script
3. Run against staging DB, verify counts match
4. Run against production DB on go-live day
5. Keep Excel as read-only archive

---

## Reusable Frontend Logic

The frontend is complete and frozen. Backend must match these contracts exactly:

| Frontend Assumption | Expected API Behavior |
|--------------------|-----------------------|
| RFQ list uses `rfqNumber`, `status`, `itemsCount`, `estimatedValueInr` fields | Backend returns these exact field names (camelCase) |
| Quote acceptance via button on quote detail page | `POST /quotes/:id/accept` must return `{ status: 'accepted' }` |
| Shipment status pill colors: in_transit=blue, in_customs=amber, arrived_india=green | Status enum values: exactly `in_transit`, `in_customs`, `arrived_india` |
| BOM upload expects job-based async response | `POST /rfqs/:id/bom` returns 202 with `{ jobId }`, not 200 with parsed items |
| Invoice PDF download | `GET /invoices/:id/download` returns signed URL redirect |