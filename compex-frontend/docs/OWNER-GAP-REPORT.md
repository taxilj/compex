# Owner Gap Report
**Date:** 2026-08-20 | **Branch:** master

> Grouped by status. Every entry backed by evidence from code inspection, build output, or test results.

---

## COMPLETE (26 items)

These requirements have working code, real API endpoints, real DB models, and verified behavior.

| # | Requirement | Evidence |
|---|-------------|----------|
| 1 | BOM upload — Excel (XLSX/XLS) | `bom-upload.ts` + `xlsx` library; BullMQ worker; items created in DB |
| 2 | BOM upload — CSV | Same xlsx parser; CSV accepted |
| 3 | BOM upload — Background processing | `bom-processor.ts` worker via BullMQ |
| 4 | RFQ creation (portal) | `/portal/rfqs/new` form → POST `/api/v1/rfqs` → DB |
| 5 | RFQ submit → Lead auto-created | `submitRfq()` calls `Lead.create()` |
| 6 | Customer confirmation email (code) | `rfqConfirmationEmail()` called in `submitRfq()` |
| 7 | Follow-up email (code) | `followUpEmail()` template; worker sends via `sendEmail()` |
| 8 | Admin RFQ management | `/admin/rfqs` + live API |
| 9 | Vendor sourcing API | VendorRfq, VendorRfqItem, VendorQuote models + full CRUD |
| 10 | Landed cost API | All financial fields; Decimal(18,4); formula implemented |
| 11 | Quotation creation with Decimal pricing | `calcItems()` uses Decimal library; Decimal(18,4) schema |
| 12 | Quotation sequential numbering | `QUO-YYYY-XXXXXX`; DB-level concurrency-safe |
| 13 | Quotation PDF generation | `pdfkit` in `src/lib/pdf.ts`; GET `/:id/pdf` |
| 14 | Quotation email with PDF attachment | POST `/:id/send` generates + attaches PDF |
| 15 | Customer quotation portal | `/portal/quotes` + `/portal/quotes/[id]` + accept/reject |
| 16 | Quotation — Vendor cost hidden | `CUSTOMER_QUOTE_SELECT` excludes all internal data; verified in code |
| 17 | Lead DB model | All expected fields: source, status, priority, assignedToId, estimatedValue |
| 18 | Admin leads CRUD API | Full CRUD + status management at `/api/v1/admin/leads` |
| 19 | Follow-up scheduler | Day 1/3/7/14 delays in BullMQ |
| 20 | Follow-up idempotency | `@@unique([rfqId, type])` + `findUnique` guard (migration 004) |
| 21 | Follow-up cancellation | `cancelFollowUps()` wired to: quotation send/accept/reject, lead WON/LOST |
| 22 | JWT auth + refresh token rotation | `authenticate` middleware; `/api/v1/auth` routes |
| 23 | RBAC (CUSTOMER / STAFF / ADMIN) | `requireRole()` on all admin/portal routes |
| 24 | Tenant isolation | All queries filter by `customerId` from JWT; 12 test assertions |
| 25 | IDOR protection | `assertOwnership()` + quotation ownership check (pre-merge fix) |
| 26 | Audit logs | `audit()` on key actions; AuditLog model |

---

## PARTIAL (10 items)

Working in part but missing critical production or UI components.

| # | Requirement | What Works | What's Missing |
|---|-------------|------------|----------------|
| 1 | Manufacturers | DB model + admin CRUD API | Frontend not wired to API; no detail pages |
| 2 | BOM upload file validation | MIME type check | File size limit; malware scan |
| 3 | BOM review UI | Page at `/portal/rfqs/[id]/bom` exists | Live API wiring (uses mock data) |
| 4 | Follow-up (production) | Code complete + idempotency | Worker NOT running in Railway |
| 5 | Follow-up timezone | Fixed ms delays work | Calendar-aware IST business day scheduling |
| 6 | Salesperson assignment | DB field + PATCH API | Assignment UI |
| 7 | Lead source attribution | 7 LeadSource enum values in DB | UTM capture to populate them |
| 8 | Email delivery (production) | Code complete | SMTP env vars not set in Railway |
| 9 | Security — file upload | MIME type checked | Size limit; malware scan |
| 10 | Navigation | 6 links + REQUEST RFQ | About, Contact, Inventory missing |

---

## UI ONLY (7 items)

Frontend UI exists but backed by hardcoded/mock data only.

| # | Requirement | What UI Shows | Why Not Real |
|---|-------------|--------------|--------------|
| 1 | Homepage search CTA | "Search Components" button | Links to 6-item mock search |
| 2 | Part number search | Search + filters on `/products` | 6-item mock array; no search API |
| 3 | Product categories | 8 tiles on homepage | No Category DB model |
| 4 | Manufacturer marquee | 10-item static list | API exists but frontend doesn't call it |
| 5 | Industries page | Content at `/industries` | No DB model |
| 6 | Homepage BOM/RFQ CTA | "Request a Quote" button | `/request-quote` form not wired to API |
| 7 | SSG product pages | 6 pages at `/products/[mpn]` | Mock data; not DB-backed |

---

## BACKEND ONLY (6 items)

API and DB complete; no admin frontend UI built.

| # | Requirement | API Available | Missing |
|---|-------------|--------------|---------|
| 1 | Vendor management | `/api/v1/admin/vendors` (full CRUD) | Admin vendor UI beyond basic list |
| 2 | Vendor RFQ workflow | `/api/v1/admin/vendor-rfqs` (CRUD + quotes) | Admin vendor RFQ/quote UI |
| 3 | Landed cost | `/api/v1/admin/vendor-rfqs/:id/landed-cost` | Admin landed cost UI |
| 4 | Admin quotation creation | POST `/api/v1/admin/quotations` | Admin form to create quotation |
| 5 | Admin leads management | `/api/v1/admin/leads` (full CRUD) | `/admin/leads` frontend page |
| 6 | Salesperson assignment | PATCH API accepts `assignedToId` | Assignment UI |

---

## MOCKED (2 items)

Frontend display exists but all values are hardcoded literals.

| # | Requirement | What's Hardcoded |
|---|-------------|-----------------|
| 1 | Sales dashboard stats | 5 stat tiles with literal numbers in `const adminStats[]` |
| 2 | Admin dashboard recent activity | Only Recent RFQs table is live; all other tiles hardcoded |

---

## MISSING (37 items)

No implementation exists. Full build required.

### Discovery & Search
- Product DB model (MPN, manufacturer, category, description, package, status, availability)
- MPN search API endpoint
- `/part/[slug]` dynamic route (DB-backed)
- Category DB model + admin management + public pages
- Manufacturer detail pages (`/manufacturers/[slug]`)
- Industry detail pages (`/industries/[slug]`)
- India city SEO pages (13 cities: Mumbai, Pune, Bengaluru, Chennai, Hyderabad, Delhi, Noida, Ahmedabad, Surat, Vadodara, Rajkot, Gurugram, Kolkata)

### BOM Upload
- PDF parser (pdfjs-dist or pdf-parse)
- Word (.docx) parser (mammoth or docx)
- Image / OCR parser (Tesseract or cloud OCR)

### RFQ & Sales Flow
- Salesperson notification email on new RFQ
- `/request-quote` public form wired to POST `/api/v1/rfqs`
- Order DB model + creation flow
- Revenue tracking and reporting

### Admin Frontend
- `/admin/leads` page (leads list, detail, assignment, status transitions)
- Admin vendor RFQ UI (send RFQ, view vendor quotes)
- Admin landed cost UI (entry form)
- Admin quotation create UI (form with items, pricing, tax)

### Vendor Operations
- Vendor email notification when RFQ sent
- Vendor quote comparison (side-by-side)

### Inventory
- Inventory DB model (part, manufacturer, qty, location, date code, package)
- Admin inventory management
- Public stock availability on product pages
- Excess/obsolete inventory upload flow + lead creation

### WhatsApp & AI
- WhatsApp floating CTA (wa.me deep link with prefilled message)
- AI chatbot (electronics-focused, RFQ intake)

### SEO Infrastructure
- `app/sitemap.ts` (dynamic sitemap from DB)
- `public/robots.txt`
- JSON-LD structured data (Product, Organization, BreadcrumbList schemas)
- Internal linking graph (product ↔ manufacturer ↔ category ↔ industry ↔ city)

### Digital Marketing
- Google Analytics 4 (gtag / GTM)
- Meta Pixel
- LinkedIn Insight Tag
- Google Tag Manager container
- UTM parameter capture on landing
- Campaign → RFQ → Quotation → Revenue attribution chain

### Dashboard & KPIs
- Live aggregate queries for all dashboard KPI tiles
- "Qualified RFQ" workflow and metric

### Production Infrastructure
- Follow-up worker process in Railway (separate service or updated startCommand)
- Rate limiting on auth and public API endpoints

---

## BLOCKED (1 item)

Cannot complete without external authoritative data.

| # | Requirement | Blocker |
|---|-------------|---------|
| 1 | Legally accurate customs/IGST calculation | Requires CBIC API or authoritative HS code tariff database. Current manual input is not legally authoritative. |

---

## EXTERNAL DEPENDENCY (4 items)

Code work done or not started; requires external service or credentials.

| # | Requirement | What's Needed |
|---|-------------|--------------|
| 1 | SMTP email delivery | Railway env vars: `EMAIL_PROVIDER=smtp` + `SMTP_*` |
| 2 | Redis for BullMQ | Railway Redis plugin + `REDIS_URL` env var |
| 3 | WhatsApp Business API | WhatsApp Business account + API credentials |
| 4 | Production file storage | AWS S3 bucket + credentials (currently local filesystem) |

---

## Production Configuration Required

**Railway (backend):**
```
DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_URL,
CORS_ORIGIN, EMAIL_PROVIDER=smtp, SMTP_HOST, SMTP_PORT,
SMTP_USER, SMTP_PASS, SMTP_FROM,
STORAGE_PROVIDER=s3, S3_BUCKET, S3_REGION,
S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
```

**Vercel (frontend):**
```
NEXT_PUBLIC_API_URL  — Railway API URL
```

---

## Security Gaps

| Gap | Severity | Status |
|-----|----------|--------|
| Rate limiting absent | HIGH | MISSING — no `@fastify/rate-limit` |
| Signed URLs for documents | HIGH | MISSING — filesystem serving without access control |
| Follow-up worker not running | HIGH | MISSING — Railway startCommand incomplete |
| SMTP not configured | HIGH | EXTERNAL DEPENDENCY |
| File upload size limit | MEDIUM | PARTIAL — MIME check only |
| Malware scan on uploads | LOW | MISSING |

---

## Business-Critical Gaps (Top 10)

1. **`/request-quote` form not wired** — Zero public lead capture from the primary CTA
2. **Follow-up worker not in Railway** — All automated follow-up emails fail silently
3. **SMTP not configured** — No emails delivered in production (confirmation, quotation, follow-up)
4. **Admin leads UI missing** — CRM is unusable from the frontend
5. **Admin quotation create UI missing** — Admins cannot create quotations without API access
6. **Vendor email notification missing** — Vendor sourcing workflow stalls; vendors never notified
7. **Salesperson notification missing** — New RFQs arrive silently; no admin knows
8. **Product database missing** — No organic search traffic possible; no SEO
9. **Order model missing** — No post-quotation revenue tracking
10. **Analytics not installed** — No visibility into traffic, conversions, or marketing ROI

---

## Nice-to-Have Gaps

- WhatsApp deep link (simple; high conversion value — recommend prioritizing)
- AI chatbot
- Excess/obsolete inventory section
- Advanced vendor quote comparison UI
- City SEO pages (add after product DB is live)
- Blog / FAQ CMS
- Customer order history portal
