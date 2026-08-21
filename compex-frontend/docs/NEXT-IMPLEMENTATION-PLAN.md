# Next Implementation Plan
**Date:** 2026-08-20 | **Branch:** master

> Prioritized P0/P1/P2/P3 implementation plan.
> P0 = production blocker (platform non-functional without it)
> P1 = primary conversion funnel (directly drives RFQ to revenue)
> P2 = discovery and SEO (drives traffic that feeds P1)
> P3 = advanced features (competitive differentiation)

---

## P0 — Production Blockers (fix before any public launch)

These are not features. The platform silently fails in production without them.

### P0-1: Start Follow-up Worker in Railway

**Why it matters:** `railway.json` startCommand runs `npm start` only (API server). The `follow-up-worker.ts` BullMQ consumer never starts. All Day 1/3/7/14 follow-up emails silently fail.

**Current state:** Worker code complete and passes tests. Railway config missing worker start.

**Files to change:** `compex-api/railway.json` — add second service with `startCommand: "npm run worker"`

**Estimated complexity:** Very Low (config change only)

**Recommended order:** First.

---

### P0-2: Configure SMTP in Railway

**Why it matters:** `EMAIL_PROVIDER` defaults to `log`. All emails — RFQ confirmation, quotation, follow-up — are console-logged and never delivered.

**Current state:** Code complete. `.env.example` documents all required vars.

**Files to change:** Railway dashboard env vars only. No code change.

**Required vars:** `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Estimated complexity:** Configuration only.

**Recommended order:** Second, with P0-4.

---

### P0-3: Wire `/request-quote` Public Form to API

**Why it matters:** The primary public CTA "Request a Quote" submits to nothing. Zero public lead capture.

**Current state:** Form renders statically in `/request-quote/page.tsx`. No API call on submit.

**Files:**
- `compex-frontend/src/app/request-quote/page.tsx` — add submit handler with API call
- `compex-frontend/src/lib/api/quotes.ts` — add public RFQ creation function

**Decision required:** Does the public form require auth (force registration) or create a guest enquiry (no auth)? A guest enquiry requires a new backend endpoint.

**Estimated complexity:** Medium

**Recommended order:** Third.

---

### P0-4: Provision Redis in Railway

**Why it matters:** BullMQ requires Redis for both BOM processing and follow-up queues. Without `REDIS_URL`, both workers crash on startup.

**Files to change:** Railway dashboard — add Redis plugin; set `REDIS_URL` env var.

**Estimated complexity:** Configuration only.

**Recommended order:** With P0-1 and P0-2.

---

### P0-5: Verify Vercel NEXT_PUBLIC_API_URL

**Why it matters:** `apiFetch` in `compex-frontend/src/lib/api/client.ts` falls back to `http://localhost:4000/api/v1`. If this env var is not set in Vercel, all portal and admin API calls are dead in production.

**Files to change:** Vercel dashboard env vars only. No code change.

**Estimated complexity:** Configuration only.

---

## P1 — Primary Conversion Funnel

These directly drive the RFQ-to-revenue workflow.

### P1-1: WhatsApp Floating CTA

**Why it matters:** High-intent visitors who won't fill a form will WhatsApp. Implementation costs less than an hour. Direct lead channel with zero infrastructure cost.

**Current state:** Nothing exists.

**Files to create:**
- `compex-frontend/src/components/ui/WhatsAppCTA.tsx` — floating button with wa.me deep link
- `compex-frontend/src/app/layout.tsx` — import and render at root layout level

**Implementation:** `href="https://wa.me/91XXXXXXXXXX?text=..."` — simple deep link, not WhatsApp Business API.

**Estimated complexity:** Very Low (one component, one import)

**Recommended order:** Do immediately — highest ROI per hour of any feature.

---

### P1-2: Salesperson Notification Email

**Why it matters:** When a customer submits an RFQ, no staff member is notified. Leads go cold while salespersons are unaware.

**Current state:** `submitRfq()` sends customer email only.

**Files:**
- `compex-api/src/lib/email.ts` — add `newRfqStaffEmail()` template
- `compex-api/src/modules/rfqs/rfqs.service.ts` — add `sendEmail(newRfqStaffEmail(...))` after lead creation

**Dependencies:** SMTP configured (P0-2); `STAFF_NOTIFICATION_EMAIL` env var added

**Estimated complexity:** Low

---

### P1-3: Admin Leads Management UI

**Why it matters:** Salespersons cannot see, assign, or work leads from the frontend. Full CRUD API exists but is inaccessible without direct API calls.

**Current state:** `/api/v1/admin/leads` API complete. No frontend page.

**Files to create:**
- `compex-frontend/src/app/admin/leads/page.tsx` — list with status/source filters
- `compex-frontend/src/app/admin/leads/[id]/page.tsx` — detail with status transitions, notes, assignment
- `compex-frontend/src/lib/api/admin.ts` — `listAdminLeads()`, `getAdminLead()`, `updateAdminLead()` (stubs may exist)

**Estimated complexity:** Medium

---

### P1-4: Admin Quotation Create UI

**Why it matters:** Admins must use direct API calls to create quotations. No frontend form exists.

**Current state:** POST `/api/v1/admin/quotations` complete with Decimal arithmetic. No admin form.

**Files to create:**
- `compex-frontend/src/app/admin/quotations/new/page.tsx` — multi-step: customer → RFQ → line items → submit
- `compex-frontend/src/lib/api/admin.ts` — `createAdminQuotation()`

**Estimated complexity:** High (complex form with item management, Decimal display)

---

### P1-5: Vendor Email Notification

**Why it matters:** Admin creates a vendor RFQ but the vendor is never emailed. Manual outreach required for every sourcing request.

**Current state:** No vendor email in any route handler.

**Files:**
- `compex-api/src/lib/email.ts` — add `vendorRfqEmail()` template
- `compex-api/src/modules/admin/admin.vendor-rfqs.routes.ts` — call `sendEmail(vendorRfqEmail(...))` on VendorRfq creation

**Dependencies:** SMTP configured (P0-2); Vendor model has email field

**Estimated complexity:** Low

---

### P1-6: Admin Vendor Sourcing Workflow UI

**Why it matters:** Full vendor RFQ → quote → landed cost pipeline exists in API but is inaccessible from frontend. Admin cannot complete sourcing workflow without direct API access.

**Current state:** All APIs complete at `/api/v1/admin/vendor-rfqs`. Only `/admin/vendors` list page exists.

**Files to create:**
- `compex-frontend/src/app/admin/vendor-rfqs/page.tsx` — list with status filters
- `compex-frontend/src/app/admin/vendor-rfqs/[id]/page.tsx` — detail + send + view quotes
- `compex-frontend/src/app/admin/vendor-rfqs/[id]/landed-cost/page.tsx` — landed cost entry form
- `compex-frontend/src/lib/api/admin.ts` — vendor RFQ + landed cost API functions

**Estimated complexity:** High

---

### P1-7: Rate Limiting on Auth Endpoints

**Why it matters:** No brute-force protection on login or registration. Trivially exploitable.

**Files:**
- `compex-api/package.json` — add `@fastify/rate-limit`
- `compex-api/src/app.ts` — register plugin; apply 20 req/min to `/api/v1/auth/*`

**Estimated complexity:** Low

---

## P2 — Discovery and SEO

### P2-1: Product Database + MPN Search

**Why it matters:** Zero organic search possible without a real product catalog. This unlocks all SEO, all discovery, and all part-number-driven traffic.

**Current state:** No Product model in schema. Six mock SSG pages only.

**Files to create/modify:**
- `compex-api/prisma/schema.prisma` — add `Product`, `Category` models
- New migration
- `compex-api/src/modules/admin/admin.products.routes.ts` — admin CRUD (import, create, update)
- `compex-api/src/modules/products/products.routes.ts` — public search API (MPN, manufacturer, category, description)
- `compex-frontend/src/app/products/page.tsx` — replace mock array with live search API
- `compex-frontend/src/app/part/[slug]/page.tsx` — DB-backed part detail (replaces or supplements `/products/[mpn]`)

**Dependencies:** Manufacturer model exists. Category model must be added.

**Estimated complexity:** Very High (schema + migrations + admin UI + search API + frontend)

---

### P2-2: Sitemap, Robots, and JSON-LD

**Why it matters:** Google cannot discover or properly index any page without these.

**Files to create:**
- `compex-frontend/src/app/sitemap.ts` — dynamic sitemap from product/manufacturer/category DB
- `compex-frontend/public/robots.txt` — allow all, point to sitemap URL
- `compex-frontend/src/app/part/[slug]/page.tsx` — add Product JSON-LD
- `compex-frontend/src/app/page.tsx` — add Organization JSON-LD

**Dependencies:** P2-1 for meaningful sitemap entries (can ship static sitemap before P2-1)

**Estimated complexity:** Low-Medium

---

### P2-3: Manufacturer Detail Pages

**Why it matters:** "STMicroelectronics distributor India" and similar branded searches are high-intent, zero-cost traffic.

**Current state:** Manufacturer DB model + admin API exist. Frontend hardcodes 10 items; `listManufacturers()` API function exists in `admin.ts` but is unused.

**Files:**
- `compex-frontend/src/app/manufacturers/page.tsx` — wire to live API (replace hardcoded list)
- `compex-frontend/src/app/manufacturers/[slug]/page.tsx` — DB-backed detail page with products + RFQ CTA

**Dependencies:** P2-1 for product relationships on manufacturer pages

**Estimated complexity:** Medium

---

### P2-4: India City SEO Pages

**Why it matters:** "Electronic component supplier Mumbai" is high-intent, low-competition local search with direct business relevance.

**Current state:** Nothing implemented.

**Files to create:**
- `compex-frontend/src/lib/data/cities.ts` — city metadata with unique content per city (not templated)
- `compex-frontend/src/app/location/[city]/page.tsx` — SSG page with city-specific content + RFQ CTA

**Estimated complexity:** Low (13 cities; can be SSG with unique static content per city)

---

### P2-5: Google Analytics and GTM

**Why it matters:** Currently zero visibility into traffic, sources, user behavior, or conversion rate. Cannot measure ROI of any marketing spend.

**Current state:** No analytics anywhere in codebase.

**Files:**
- `compex-frontend/src/app/layout.tsx` — add GTM script tags (head + body noscript)

**Dependencies:** GTM account, GA4 property (external)

**Estimated complexity:** Very Low (two script tags; takes 30 minutes)

**Recommended order:** Do before any marketing spend.

---

## P3 — Advanced Features

### P3-1: UTM Capture + Marketing Attribution

**Why:** Closes the loop from ad spend to RFQ to revenue.

**Files:**
- `compex-frontend/src/hooks/useUtm.ts` — extract UTM params, store in sessionStorage
- Wire UTM → RFQ creation payload → Lead.source + new UTM fields in schema

**Estimated complexity:** Medium

---

### P3-2: Order Model + Revenue Tracking

**Why:** Converts the quotation acceptance into tracked revenue.

**Files:**
- `compex-api/prisma/schema.prisma` — add `Order` model linked to Quotation + Customer
- New migration
- `compex-api/src/modules/admin/admin.orders.routes.ts`
- `compex-frontend/src/app/admin/orders/page.tsx`

**Estimated complexity:** High

---

### P3-3: Live Sales Dashboard KPIs

**Why:** Replace 5 hardcoded stat tiles with real DB aggregates.

**Files:**
- `compex-api/src/modules/admin/admin.dashboard.routes.ts` — new `/api/v1/admin/dashboard/stats` route with Prisma aggregates
- `compex-frontend/src/app/admin/page.tsx` — replace `const adminStats[]` with API call

**Estimated complexity:** Medium

---

### P3-4: Excess/Obsolete Inventory Upload

**Why:** Owner-stated requirement; generates inbound leads from electronics traders.

**Files:**
- `compex-api/prisma/schema.prisma` — add `ExcessInventory` model
- New migration
- `compex-api/src/modules/inventory/inventory.routes.ts`
- `compex-frontend/src/app/inventory/sell/page.tsx`

**Estimated complexity:** High

---

### P3-5: AI Chatbot

**Why:** Natural language RFQ intake; competitive differentiation.

**Files:**
- `compex-frontend/src/components/chat/ChatWidget.tsx`
- `compex-api/src/modules/ai/ai.routes.ts` — LLM integration

**Dependencies:** LLM API key; product DB for context (P2-1)

**Estimated complexity:** Very High

---

## Recommended Execution Order

```
WEEK 1 — Go-live unblocked
  P0-4  Provision Redis in Railway
  P0-1  Start worker in Railway
  P0-2  Configure SMTP in Railway
  P0-5  Verify NEXT_PUBLIC_API_URL in Vercel
  P0-3  Wire /request-quote form to API

WEEK 2 — Funnel operational
  P1-1  WhatsApp CTA (30 min, do first)
  P1-2  Salesperson notification email
  P1-5  Vendor email notification
  P1-7  Rate limiting
  P1-3  Admin leads UI (start)

WEEK 3-4 — Admin workflow complete
  P1-3  Admin leads UI (finish)
  P1-4  Admin quotation create UI
  P1-6  Admin vendor sourcing UI

MONTH 2 — Organic growth
  P2-5  Google Analytics + GTM (2 hrs, do before any marketing)
  P2-2  Sitemap + robots + JSON-LD
  P2-1  Product database (multi-week)
  P2-3  Manufacturer detail pages
  P2-4  India city SEO pages

MONTH 3+ — Scale
  P3-3  Live dashboard KPIs
  P3-1  UTM attribution
  P3-2  Order model
  P3-4  Excess inventory
  P3-5  AI chatbot
```

---

## Dependency Graph

```
P0-4 Redis → P0-1 Worker → P0-2 SMTP → P1-2 Staff email
                                      → P1-5 Vendor email
                                      → Follow-up emails delivered

P0-3 Wire /request-quote → Leads accumulate → P1-3 Leads UI
                                             → P1-4 Quotation UI
                                               → P1-6 Vendor UI
                                                 → P3-2 Orders

P2-1 Product DB → P2-2 Sitemap
               → P2-3 Manufacturer pages
               → P3-5 AI chatbot

P2-5 Analytics   (independent — do early)
P1-1 WhatsApp    (independent — do immediately)
```
