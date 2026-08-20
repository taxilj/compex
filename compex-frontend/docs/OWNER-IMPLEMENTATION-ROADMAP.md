# Owner Implementation Roadmap
> Audit date: 2026-08-20

## Business Objective

The owner's core revenue funnel:

```
Visitor -> Search/BOM -> RFQ -> Lead -> Sales review ->
Vendor sourcing -> Vendor quote -> Landed cost ->
Customer quotation -> Follow-up -> Order -> Revenue
```

Every P0 item directly unblocks the next step in this funnel.

---

## P0 — Critical: Revenue-Blocking

### P0-A: Vendor + Manufacturer + Admin Wiring
**Goal:** Admin can see real RFQs and manage vendors.

- [ ] Prisma models: Vendor, Manufacturer
- [ ] API routes: GET/POST /api/admin/vendors, GET/POST /api/admin/manufacturers
- [ ] Prisma models: VendorRfq, VendorRfqItem
- [ ] API routes: admin create/list/get vendor RFQs, add vendor quote
- [ ] Wire admin RFQ list page to real GET /api/admin/rfqs (remove mockRFQs)
- [ ] Add fastify-rate-limit to the API
- [ ] Run: tsc --noEmit + vitest run + npm run build

### P0-B: Lead/CRM + Landed Cost + Email wiring
**Goal:** Every submitted RFQ creates a lead; landed cost can be computed.

- [ ] Prisma model: Lead (rfqId, source, status, salespersonId, priority, nextFollowUp, notes)
- [ ] Auto-create Lead inside submitRfq() transaction
- [ ] Wire nodemailer into sendEmail() guarded by EMAIL_PROVIDER=smtp env var
- [ ] Add RFQ confirmation email in submitRfq()
- [ ] Prisma model: LandedCost (all Decimal(18,4), configurable rates)
- [ ] API route: POST /api/admin/rfqs/:id/landed-cost
- [ ] Formula: selling_price = (vendor_cost*qty + shipping + insurance + customs + igst + handling + other) * (1 + margin/100)
- [ ] Run: tsc + vitest + build

### P0-C: Customer Quotation + PDF + Quotation Email
**Goal:** Admin sends quotation; customer can view it in portal.

- [ ] Prisma model: CustomerQuotation (rfqId, quoteNumber, status, validUntil, sellingPrice only — NO vendor cost exposed)
- [ ] API routes: POST /api/admin/rfqs/:id/quotation, GET /api/portal/quotations/:id
- [ ] PDF generation (selling price only, vendor cost NEVER included)
- [ ] Quotation email to customer on send
- [ ] Wire portal quotes list to real API (remove mock)
- [ ] Run: tsc + vitest + build

### P0-D: Follow-up Automation + Sales Dashboard
**Goal:** Admin has real KPIs; follow-ups run safely.

- [ ] Prisma model: FollowUp (leadId, scheduledAt, type, status, cancelledAt)
- [ ] BullMQ job: schedule follow-ups at +1, +3, +7, +14 days on RFQ submit
- [ ] Cancel follow-ups when quotation sent or order created
- [ ] API route: GET /api/admin/dashboard (new RFQs, pending quotes, follow-ups today, qualified RFQ count)
- [ ] Wire admin dashboard to real data
- [ ] Run: tsc + vitest + build

---

## P1 — High Priority (After P0)

- Product/MPN Prisma model + admin CRUD + public search API
- Part-number pages /products/[mpn] from real DB
- Manufacturer detail pages /manufacturers/[slug]
- Category model + pages
- Industry detail pages /industries/[slug]
- India location pages /sourcing/[city]
- Inventory model + admin CRUD
- Wire admin customers/vendors pages to real API
- Customer registration page
- Contact form backend (POST /api/contact)
- Sitemap.xml and public/robots.txt
- OpenGraph + JSON-LD on product/MPN pages
- BOM human review step UI
- DB indexes: rfqs.status, rfqs.customer_id, rfq_items.rfq_id

---

## P2 — Important (After P1)

- WhatsApp CTA on product pages (wa.me link, no API)
- GA4 + Google Ads + Meta Pixel + LinkedIn Insight Tag
- UTM parameter capture on RFQ -> Lead
- Excess & Obsolete inventory funnel
- Blog / FAQ pages
- PDF/Word BOM (evaluate OCR vendor)

---

## P3 — Future

- AI chatbot for RFQ creation (requires real product DB first)
- Advanced OCR BOM
- Advanced marketing automation

---

## Critical Constraints

1. Never break Phase 1 or Phase 1B.
2. Incremental Prisma migrations only — never edit existing columns without migration.
3. All financial fields: Decimal(18,4). Never Float.
4. CustomerQuotation API must NEVER expose VendorQuote data.
5. Email architecture: log-mode default is safe; SMTP activates on EMAIL_PROVIDER=smtp env var.
6. SMTP credentials are BLOCKED — build architecture; activate when owner provides.
7. After each P0 stage run: tsc --noEmit + vitest run + npm run build.

---

## Critical Business Workflow Status

| Step | Status |
|------|--------|
| Customer searches component | PARTIAL (mock) |
| Product/Part page | PARTIAL (mock) |
| Request Quote (RFQ) | COMPLETE |
| RFQ created | COMPLETE |
| Lead created | MISSING |
| Salesperson notified | MISSING |
| Admin reviews RFQ | PARTIAL (backend real; UI mock) |
| Vendor selected | MISSING |
| Vendor RFQ created | MISSING |
| Vendor receives RFQ email | MISSING (BLOCKED: SMTP) |
| Vendor quote recorded | MISSING |
| Landed cost calculated | MISSING |
| Customer quotation generated | MISSING |
| Customer receives quotation | MISSING (BLOCKED: SMTP) |
| Follow-up automation | MISSING |
| Customer approval | MISSING |
| Sales Order / Purchase Order / Shipment / Invoice | MISSING (P1+) |
| Revenue analytics | MISSING (P1+) |
