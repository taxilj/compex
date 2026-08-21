# Owner Roadmap Status
**Date:** 2026-08-20 | **Branch:** master

> Compares the owner's phased implementation roadmap against actual codebase state.
> Evidence-only. Nothing marked complete without provable code + API + DB + test backing.

---

## Phase Overview

| Phase | Name | Owner Expectation | Functional % | Status |
|-------|------|-------------------|--------------|--------|
| 1 | Website & Brand | Full public site with live search, BOM, WhatsApp, categories, manufacturers, industries, city SEO | 20% | PARTIAL |
| 2 | Product Database | Real product catalog, MPN search, category/manufacturer pages, SEO pages | 5% | NOT STARTED |
| 3 | BOM / RFQ Pipeline | BOM upload (all formats), RFQ flow, CRM, quotation, vendor sourcing, landed cost, automation | 55% | PARTIAL |
| 4 | CRM & Sales | Admin leads UI, salesperson workflow, orders, revenue tracking | 30% | PARTIAL |
| 5 | SEO Engine | Automated DB-driven content, sitemap, structured data, city SEO | 3% | NOT STARTED |
| 6 | Digital Marketing | GA4, Meta Pixel, LinkedIn, GTM, email marketing, attribution | 0% | NOT STARTED |
| 7 | AI & Automation | AI chatbot, smart follow-up, automated quoting | 0% | NOT STARTED |

---

## Phase 1 — Website & Brand

**Owner expectation:** Full public-facing website for India's electronic component sourcing platform. Visitors find the site via part number, manufacturer, industry, or city search. Every page has strong RFQ CTAs. WhatsApp floating button drives enquiries from non-portal users.

| Feature | Actual Implementation | Gap |
|---------|----------------------|-----|
| Homepage hero + CTAs | UI built; "Request a Quote" and "Search Components" CTAs present | Both link to static/mock pages |
| Part number search | `/products` with client-side filter on 6 mock items | No real product DB or search API |
| BOM upload on homepage | Static `/request-quote` form; form not wired to API | No API call on submit |
| WhatsApp floating CTA | Not implemented anywhere | Entire feature missing |
| Product categories (8 tiles) | Static hardcoded on homepage | No DB model, no SEO pages |
| Manufacturer marquee | Static 10-item hardcoded list | Frontend does not call manufacturer API |
| Industries page | Static content at `/industries` | No DB model, no detail pages |
| City SEO (13 cities) | Not implemented | Entire feature missing |
| Live website stats | 5 hardcoded stat tiles (admin only) | Not on public homepage |
| Contact / About in nav | Missing from navigation | Pages exist but not in primary nav |

**Functional estimate:** ~20%

---

## Phase 2 — Product Database

**Owner expectation:** Real product catalog where customers can search by MPN, manufacturer, category. Thousands of SEO pages auto-generated from DB. Each part page has manufacturer relationship, category, description, availability, and RFQ CTA.

| Feature | Actual Implementation | Gap |
|---------|----------------------|-----|
| Product DB model | Not in schema.prisma | Entire model missing |
| MPN search API | Not implemented | API endpoint missing |
| Category DB model | Not in schema.prisma | Category table missing |
| `/part/[slug]` SEO pages | Not implemented; only `/products/[mpn]` (6 mock SSG pages) | Dynamic DB-backed pages missing |
| Structured data (JSON-LD) | Not implemented | Product schema missing |
| Sitemap.xml | Not implemented | Dynamic sitemap missing |
| Admin product management | Not implemented | Admin CRUD UI missing |
| Manufacturer product relationships | No foreign key in DB | Manufacturer.products relation missing |

**Functional estimate:** ~5%

---

## Phase 3 — BOM / RFQ Pipeline

**Owner expectation:** Customer uploads BOM (any format) → system parses → customer reviews → submits RFQ → lead auto-created → salesperson notified → vendor sourced → landed cost calculated → customer quotation sent → follow-up automated → order.

| Feature | Actual Implementation | Gap |
|---------|----------------------|-----|
| BOM upload (Excel/CSV) | COMPLETE — `bom-upload.ts` + BullMQ worker | — |
| BOM upload (PDF/Word/Image) | Not implemented | 3 formats missing |
| BOM review UI | Page exists at `/portal/rfqs/[id]/bom`; uses mock data | Live API wiring missing |
| RFQ creation (portal) | COMPLETE — `/portal/rfqs/new` → DB | — |
| RFQ submit → Lead created | COMPLETE — `submitRfq()` creates Lead | — |
| Customer email on submit | COMPLETE — `rfqConfirmationEmail()` sent | SMTP must be configured in prod |
| Salesperson notification | Missing | Staff email on new RFQ |
| Admin RFQ management | COMPLETE — `/admin/rfqs` with live API | — |
| Vendor sourcing (API) | COMPLETE — vendor RFQ + quote API | — |
| Vendor sourcing (UI) | Only vendor list UI; no vendor RFQ/quote UI | Admin workflow UI missing |
| Vendor email notification | Not implemented | Vendor RFQ email template |
| Landed cost (API) | COMPLETE — all fields, Decimal(18,4) | — |
| Landed cost (UI) | Not implemented | Admin landed cost UI missing |
| Customer quotation (API) | COMPLETE — create, send, PDF, email | — |
| Customer portal (quotes) | COMPLETE — `/portal/quotes` + accept/reject | — |
| Admin quotation create UI | Not implemented | Admin form to create quotation missing |
| Follow-up automation (code) | COMPLETE — Day 1/3/7/14, cancellation, idempotency | — |
| Follow-up worker (production) | NOT RUNNING — Railway only starts API server | `npm run worker` not in startCommand |
| Order creation | Not implemented | Order model + flow entirely missing |

**Functional estimate:** ~55%

---

## Phase 4 — CRM & Sales

**Owner expectation:** Admin manages all leads, assigns salespersons, tracks New Enquiry → Won/Lost, views notes, creates manual quotations, sees revenue pipeline.

| Feature | Actual Implementation | Gap |
|---------|----------------------|-----|
| Lead DB model | COMPLETE — all expected fields | — |
| Lead source enum (7 values) | COMPLETE | UTM capture to populate it missing |
| Admin leads API (CRUD) | COMPLETE — full CRUD + status management | — |
| Admin leads UI (frontend) | Not implemented | `/admin/leads` page missing |
| Salesperson assignment (API) | COMPLETE — `assignedToId` field + PATCH | — |
| Salesperson assignment (UI) | Not implemented | Assignment UI missing |
| Company / Customer DB | COMPLETE | — |
| Order DB model | Not implemented | Entire order model missing |
| Revenue tracking | Not implemented | No order → revenue chain |
| Sales dashboard KPIs | All hardcoded; only Recent RFQs is live | Live aggregates missing |
| Qualified RFQ metric | Not implemented | Qualification workflow missing |

**Functional estimate:** ~30%

---

## Phase 5 — SEO Engine

**Owner expectation:** Automated, database-driven content for thousands of pages. Dynamic sitemap. Structured data. Internal linking graph.

| Feature | Actual Implementation | Gap |
|---------|----------------------|-----|
| Dynamic sitemap | Not implemented | `app/sitemap.ts` missing |
| robots.txt | Not implemented | `public/robots.txt` missing |
| JSON-LD structured data | Not implemented | All schema types missing |
| DB-driven part pages | Not implemented | Requires Phase 2 product DB |
| DB-driven manufacturer pages | Not implemented | Requires manufacturer-product relation |
| DB-driven category pages | Not implemented | Requires Category DB model |
| City SEO pages (13 cities) | Not implemented | All missing |
| Internal linking | Not implemented | Entity graph missing |

**Functional estimate:** ~3%

---

## Phase 6 — Digital Marketing

**Owner expectation:** Full tracking stack. Lead attribution from ad spend to revenue.

| Feature | Actual Implementation | Gap |
|---------|----------------------|-----|
| Google Analytics 4 | Not implemented | Measurement ID + script |
| Meta Pixel | Not implemented | Pixel ID + PageView events |
| LinkedIn Insight Tag | Not implemented | Partner ID + script |
| Google Tag Manager | Not implemented | Container ID + dataLayer |
| Email marketing | Not implemented | Integration + list sync |
| UTM capture | Not implemented | UTM → Lead.source mapping |
| Campaign attribution | Not implemented | UTM → RFQ → Quotation → Revenue |

**Functional estimate:** 0%

---

## Phase 7 — AI & Automation

**Owner expectation:** AI chatbot, smart follow-up, automated quoting suggestions.

| Feature | Actual Implementation | Gap |
|---------|----------------------|-----|
| AI chatbot | Not implemented | Entire chatbot missing |
| Natural language RFQ intake | Not implemented | LLM integration missing |
| Smart follow-up | Fixed delays only | Priority/sentiment-based scheduling |

**Functional estimate:** 0%

---

## Production Readiness Blockers

| Blocker | Impact | Required Action |
|---------|--------|----------------|
| Follow-up worker not in Railway startCommand | Follow-up emails never sent | Add second Railway service OR update startCommand |
| SMTP not configured | No emails delivered in production | Set `EMAIL_PROVIDER=smtp` + SMTP_* env vars in Railway |
| `/request-quote` form not wired | Public RFQ form creates no leads | Wire form to POST `/api/v1/rfqs` |
| `NEXT_PUBLIC_API_URL` unknown | Frontend may hit localhost in production | Verify Vercel env var points to Railway URL |
| Redis not provisioned | BOM processing + follow-ups fail silently | Provision Railway Redis plugin + set REDIS_URL |
| Rate limiting absent | Auth endpoints vulnerable to brute-force | Add `@fastify/rate-limit` |
| No sitemap / robots.txt | Google cannot crawl site efficiently | Add static sitemap + robots.txt |
