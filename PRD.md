# COMPEX — Product Requirements Document (DRAFT for owner/engineering review)

Baseline: `origin/master` @ `2cd4275`, branch `codex/stabilise`. Drafted 2026-10-19 from source code, `D:\KAS CRM.xlsx` (the owner workbook) and the repo's existing reports. **Nothing was executed to produce this draft** — no tests, browser sessions or production form submissions were run. Statuses therefore reflect what the code and tests *say*, not proven behaviour. **Updated after Phase 4/5:** rows that cite a commit hash or "Phase 4" reflect later local test runs, read-only production checks and fixes; details are in `AUDIT-PHASE4-2026-10-19.md`.

## How to read the statuses

| Status | Meaning here |
|---|---|
| VERIFIED | Observed working this session by a check that could fail (evidence listed). Very few items qualify until Phase 9. |
| IMPLEMENTED BUT NOT VERIFIED | Code (and usually a unit test) exists; behaviour not proven live or in a browser. |
| PARTIALLY IMPLEMENTED | Some of the requirement exists; the gap is named. |
| NOT IMPLEMENTED | Confirmed absent in the code (grep or file listing). |
| BLOCKED | Cannot be specified or built without an owner answer or external access (named). |

Rules carried over from `CLAUDE.md`: no invented fields, dropdown values, manufacturers or business rules; spreadsheet "Done" cells and older reports are not proof of live behaviour.

## Sources and how far to trust them

| Source | Use | Caveat |
|---|---|---|
| `D:\KAS CRM.xlsx` (sheets INDEX, Organization, USER, Customer, Suppliers, Manufacturer, Items, Category, Settings, RFQ Log, RVL, L1-Price, Email-Log, DPASL, DASHBOARD, Task Management, Email Format) | Owner's field lists, stage priorities (INDEX "1st Stage"/"2nd stage") and role matrix | Read for field *names/labels* only. Contains example row data; none copied here. Sheets "Updates" and "Sheet1" are working notes, not read as requirements. |
| `compex-api/prisma/schema.prisma`, `src/`, `compex-frontend/src` | Current implementation | — |
| `docs/OWNER-MASTER-DATA-COMPLIANCE.md`, `compex-frontend/docs/OWNER-*.md` | Earlier gap analyses | Dated 2026-08-20..24. **Stale**: they say there is no Product/Category/Vendor model, no sitemap and no rate limiting; all now exist. Use for owner intent only. |
| `COMPEX-*.md` reports (untracked, in the original checkout) | Prior live-test narrative (Sep 2026) | Point-in-time claims, not re-run. Mouser was reported BLOCKED on 2026-09-07; current state unknown. |

Branch landscape (context, not a requirement): work not on `master` exists on sibling branches — e.g. `codex/owner-reference-alignment` ("complete order procurement delivery workflow", "complete owner BOM workflow mapping"), `hardening/crm-workflow`, `codex/scale-readiness`, `codex/release-hardening`, `codex/prod-readiness`. Whether any of it should land is an owner/engineering decision (§18).

## Production parity observed this session (read-only)

| ID | Check | Status | Evidence |
|---|---|---|---|
| PAR-1 | Vercel production deploy commit equals `origin/master` | VERIFIED | Latest production deployment READY, `githubCommitSha` = `2cd4275…` = `git ls-remote origin master` |
| PAR-2 | Render API code equals `origin/master` | VERIFIED | Live deploy `a8070ea` (status live); `git diff a8070ea 2cd4275 -- compex-api` is empty |
| PAR-3 | Render `/health` responds | VERIFIED | `GET https://compex-api.onrender.com/health` → HTTP 200 `{"status":"ok"}` |
| PAR-4 | Render plan/billing | BLOCKED (deliberately last, Phase 10) | Service listing shows instance plan `0.5c-512mb`, build plan `starter`; the billing/plan page has not been read |

---

## 1. Product purpose and users

COMPEX Solution is an Indian B2B electronics component sourcing company. The platform has a public catalogue/enquiry site, a customer portal, and an internal admin/CRM.

| Role | Access | Status |
|---|---|---|
| Public visitor | Catalogue, search, Contact, Request Quote, BOM upload | IMPLEMENTED BUT NOT VERIFIED |
| `CUSTOMER` | Portal: RFQs, quotes (accept/reject), company profile | IMPLEMENTED BUT NOT VERIFIED (`rfqs`, `quotes`, `customers` routes; `portal/` pages) |
| `STAFF`, `ADMIN` | `/admin/*` routes guarded by `requireRole` | IMPLEMENTED BUT NOT VERIFIED (integration tests `tenant-isolation`, `admin-master-security` exist, not run) |
| Department-scoped permissions (Sales/Purchase/Account/Sourcing) | Owner workbook INDEX role matrix | NOT IMPLEMENTED — see ADM-4 |

## 2. Public catalogue

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| CAT-1 | Products list/detail from the real database, no mock data | IMPLEMENTED BUT NOT VERIFIED | `products.routes.ts`, `product-search.ts`; `src/data/mock` still exists (legacy) — confirm no public screen imports it |
| CAT-2 | Public DTO exposes only factual product data (no pricing, stock, MOQ, lead time, supplier names/URLs, internal fields, provider payloads) | VERIFIED | `public-dto.ts` allowlist + `public-dto.test.ts`; Phase 4: live list and detail responses carry only the allowlisted keys |
| CAT-3 | Exact-MPN lookup queries Mouser, DigiKey, Element14 in parallel; errors never cached as "no result"; no fallback provider | IMPLEMENTED BUT NOT VERIFIED | `mpn-search-orchestrator.ts` + unit tests; real-provider behaviour untestable here (no real credentials in tests) |
| CAT-4 | Provider credentials never reach the client bundle | IMPLEMENTED BUT NOT VERIFIED | Only `NEXT_PUBLIC_API_URL` is public by design; needs a bundle scan (Phase 9) |
| CAT-5 | Product pagination | VERIFIED | API `page`/`limit` (default 24, max 100) with total — live `meta` observed in Phase 4 (803 products); the frontend pager exists but is not browser-tested |
| CAT-6 | Product detail SEO metadata from real API data | IMPLEMENTED BUT NOT VERIFIED | `products/[mpn]/layout.tsx` `generateMetadata` + `layout.test.ts` |
| CAT-7 | Catalogue index/search tuned for scale (trigram + compound indexes, ID-pre-resolved manufacturer search, load shedding) | NOT IMPLEMENTED on this branch | Exists on `codex/scale-readiness` / `hardening/production-readiness` only; `master` search path unchanged (see PERF-3/4) |

## 3. Category navigation

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| NAV-1 | Menu built from the real recursive category tree (no hard-coded or sliced samples) | IMPLEMENTED BUT NOT VERIFIED | `categories.routes.ts` builds a full-depth tree from flat rows; `PublicHeader.tsx` renders the `listCategories()` result |
| NAV-2 | Desktop: top-level categories with children shown on hover/focus | PARTIALLY IMPLEMENTED | The **Products** panel opens on *click*; children appear on hover/focus of a parent. Whether the panel itself should open on hover is an owner/UX decision (§18) |
| NAV-3 | Desktop keyboard: Esc closes and returns focus to trigger | PARTIALLY IMPLEMENTED | `NavDropdown` handles Esc + focus return; arrow-key traversal inside the tree is not implemented |
| NAV-4 | Mobile drawer with accordion categories | IMPLEMENTED BUT NOT VERIFIED | `Sheet` + `MobileCategoryTree` (`<details>`) |
| NAV-5 | Loading, empty, error + retry states | IMPLEMENTED BUT NOT VERIFIED | `DropdownLoading/Empty/Error` for categories and manufacturers; `PublicHeader.test.tsx` |
| NAV-6 | `/categories` index page and `?categoryId=` filtering on `/products` | IMPLEMENTED BUT NOT VERIFIED | `(public)/categories/page.tsx`; menu links use the param |
| NAV-7 | Category taxonomy content matches the owner "Category" sheet (373 rows: Product Group → Product Category, HS Code/HSN/USA HTS, Custom Duty) | PARTIALLY IMPLEMENTED | Production serves 18 flat categories (max depth 1) against the owner sheet's 373-row Group → Category hierarchy (Phase 4 F8) — a data import, not a code defect; row-level comparison not done |

## 4. Header search and exact MPN

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| SRCH-1 | Debounced search (300 ms, min 2 chars) | IMPLEMENTED BUT NOT VERIFIED | `HeaderSearch.tsx` constants |
| SRCH-2 | Stale-request protection | IMPLEMENTED BUT NOT VERIFIED | `AbortController` + per-request id; `HeaderSearch.test.tsx` |
| SRCH-3 | Exact MPN routes straight to the product page | IMPLEMENTED BUT NOT VERIFIED | Exact match in results wins; otherwise a part-number-looking string (has a digit, no spaces) routes to `/products/<MPN>` and relies on detail-page on-demand lookup; other text goes to `/products?q=` |
| SRCH-4 | Category-scoped search | IMPLEMENTED BUT NOT VERIFIED | Category `<select>` populated from the real tree |
| SRCH-5 | Keyboard and ARIA combobox behaviour | IMPLEMENTED BUT NOT VERIFIED | Arrow/Enter/Esc handlers, `role="combobox"`, `aria-activedescendant` |
| SRCH-6 | "Search multiple MPNs" tool | IMPLEMENTED BUT NOT VERIFIED | `tools/search-multiple` (noindex by design) |
| SRCH-7 | No-result → request-sourcing CTA | IMPLEMENTED BUT NOT VERIFIED | Link to `/request-quote?mpn=` |

## 5. Manufacturer directory

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| MFR-1 | Public list + detail by slug, real data | IMPLEMENTED BUT NOT VERIFIED | `manufacturers.routes.ts`, `(public)/manufacturers/**` |
| MFR-2 | Directory pagination | VERIFIED | API takes `limit` and returns a total — observed live in Phase 4 (122 manufacturers); page UI not browser-tested |
| MFR-3 | Detail SEO metadata | IMPLEMENTED BUT NOT VERIFIED | `manufacturers/[slug]/layout.tsx` |
| MFR-4 | Admin manufacturer master has the owner fields (Name, Website, Distributor Link, Stock Check Link, Image, Acquired Mfr, Remarks, Suffix Information) | IMPLEMENTED BUT NOT VERIFIED | All present on the `Manufacturer` model; admin form wiring not audited |

## 6. Product detail

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PD-1 | Detail shows MPN, manufacturer, description, category, images, datasheet, lifecycle, specs | IMPLEMENTED BUT NOT VERIFIED | `Product` model + `toPublicProduct` |
| PD-2 | MPNs containing `/` route correctly | IMPLEMENTED BUT NOT VERIFIED | Fix noted in the Sep-7 report; `encodeURIComponent` used in links |
| PD-3 | Structured data (JSON-LD) | NOT IMPLEMENTED | No `ld+json` anywhere in `compex-frontend/src` |
| PD-4 | Canonical + Open Graph | VERIFIED | Canonical and og:title seen live on `/products` (Phase 4); `pageMetadata()` in `lib/site.ts`; canonical host defaults to the `vercel.app` URL unless `NEXT_PUBLIC_SITE_URL` is set — custom domain is an owner item (§18) |

## 7. Contact, enquiry, Request Quote and BOM

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| ENQ-1 | Contact / Request Quote / BOM enquiries saved to PostgreSQL **before** any email | IMPLEMENTED BUT NOT VERIFIED | `createWebsiteEnquiry`: lead + items + audit in one transaction, then email; `website-enquiries.test.ts`, `rfq-email-submission.test.ts` |
| ENQ-2 | Idempotency / duplicate protection | IMPLEMENTED BUT NOT VERIFIED | `Idempotency-Key` UUID header, unique key, P2002 race handled; honeypot field; rate limit 5/min |
| ENQ-3 | Notification to the configured company mailbox | IMPLEMENTED BUT NOT VERIFIED | `ENQUIRY_NOTIFICATION_TO` (value in `render.yaml` is a company address). **Mailbox receipt is not provable from code** — needs a controlled delivery test (Phase 9) |
| ENQ-4 | Customer address used as Reply-To | IMPLEMENTED BUT NOT VERIFIED | `replyTo: input.contactEmail` |
| ENQ-5 | Email failure keeps the lead and records status | IMPLEMENTED BUT NOT VERIFIED | `notificationStatus` PENDING/SENT/FAILED + audit; 45 s budget |
| ENQ-6 | Re-send of FAILED notifications | VERIFIED | Phase 4 F6, fixed in `10c33d9`: `jobs/notification-recovery.ts` re-sends FAILED and stuck-PENDING leads every 10 min (max 5 attempts, 3 days, Postgres only) and the admin Enquiries page flags failures. Checked by 14 backend + 3 frontend unit tests and 4 integration tests on a disposable database with the test outbox; real SMTP delivery not exercised |
| ENQ-7 | Customer acknowledgement email | PARTIALLY IMPLEMENTED | Implemented but `ENQUIRY_ACK_ENABLED="false"` in `render.yaml` (disabled by configuration) |
| ENQ-8 | Honest BOM capability state | VERIFIED | `GET /leads/bom-capability` = durable storage AND queue available; live it returns `available:false` while Render logs show the Redis quota exceeded (Phase 4) — honest, but see ENQ-10 |
| ENQ-9 | BOM upload validation (types, size, rows) | IMPLEMENTED BUT NOT VERIFIED | `lead-bom-upload.ts`, `bom-validation.test.ts`; XLSX/CSV only. PDF/Word/image BOMs NOT IMPLEMENTED (owner has not specified extraction — BLOCKED, §18) |
| ENQ-10 | Redis outage never blocks enquiries; stranded BOMs recover; no double-append | PARTIALLY IMPLEMENTED | `bom-recovery.ts`, `bom-queue-health.test.ts`, `bom-concurrency.test.ts`; in production the Redis quota is exhausted, the queue is down and BOM upload is reported unavailable (Phase 4 F2). Needs a disposable-Redis run (Phase 9) |
| ENQ-11 | Portal RFQ create/edit/submit with tenant isolation | IMPLEMENTED BUT NOT VERIFIED | `rfqs.routes.ts`; integration `tenant-isolation.test.ts` (destructive DB test; not run) |
| ENQ-12 | Workbook "RFQ Log" shape: header (Enquiry No., Customer, Sales Person, RFQ/Due/Quote Date, SBU Type, Company, Sourcing, Comments, Quotation#, Conversion Rate) + lines (Cust Part, RFQ Part, Make, Qty, Offered Part/Make/DC/MOQ/SPQ/Qty, Unit Price, Lead Time, Cost, Vendor, Charges, PV/SV/GM/GM%) | PARTIALLY IMPLEMENTED | `Lead`/`Rfq`/`RfqItem`/`VendorQuote`/`LandedCost`/`Quotation` cover much of it; a field-by-field diff against the sheet has not been done. The sheet's margin formulas must not be re-implemented until the owner confirms them (§18) |

## 8. Customer, vendor, manufacturer and product masters

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| MST-1 | Customer master (workbook "Customer": ~25 fields incl. Bill/Ship split, GSTIN, type, terms, credit limit, region, sales person/coordinator/sourcing owner, contacts) | IMPLEMENTED BUT NOT VERIFIED | `Company` model carries these fields; `admin.customers.routes.ts` |
| MST-2 | Customer-or-Vendor-or-Both selector | PARTIALLY IMPLEMENTED | `relationshipType` exists on `Company`; no link from a company to a `Vendor` record — behaviour for "Both" to be confirmed (§18) |
| MST-3 | Vendor master (workbook "Suppliers": ~20 fields + contact list) | IMPLEMENTED BUT NOT VERIFIED | `Vendor` model + `admin.vendors.routes.ts` (activate/deactivate) |
| MST-4 | Manufacturer master | IMPLEMENTED BUT NOT VERIFIED | see MFR-4 |
| MST-5 | Product ("Items") master (Code, Description, Part No*, Manufacturer*, SPQ, Packaging, Parts Status, UOM, HS Code/Desc, Category*, Group*, Stock, ECCN, history) | IMPLEMENTED BUT NOT VERIFIED | `Product` fields present; `GET /admin/products/:id/history` exists. "Available Stock" must stay admin-only (CAT-2) |
| MST-6 | Auto-generated codes from Organization prefixes (Customer ID, Vendor Code, Product Code) | NOT IMPLEMENTED | Prefix fields are stored on `Organization` but no ID generator reads them (Phase 4 F7); numbering rules need an owner decision |
| MST-7 | Organization master (~30 fields incl. bank details, logo, signature) | IMPLEMENTED BUT NOT VERIFIED | `Organization` model, `admin.organizations.routes.ts`; logo/signature are URL text, not uploads |
| MST-8 | Admin-only import/export of Customer, Vendor, RVL, Enquiry with sample formats (INDEX row 1) | PARTIALLY IMPLEMENTED | Lead export (`GET /admin/leads/export`) and product CSV import exist; Customer/Vendor/RVL import-export and sample templates NOT IMPLEMENTED |
| MST-9 | RVL (approved vendor list by MAKE; upload for emailing) | NOT IMPLEMENTED | No model or route; the sheet shows only `MAKE` plus the upload requirement |
| MST-10 | L1-Price sheet (Bid Number, Material, Price, Per, Currency, MOQ, SP Qty…) | NOT IMPLEMENTED | No equivalent model; relation to `VendorQuote` unspecified (§18) |

## 9. Settings-backed dropdowns

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| SET-1 | Generic editable LOV store | IMPLEMENTED BUT NOT VERIFIED | `Setting` (category, value, sortOrder, isEditable, isActive); `admin.settings.routes.ts` (create/edit/activate/deactivate/delete, read-only values protected) |
| SET-2 | Values come from the owner's Settings sheet, not invented | IMPLEMENTED BUT NOT VERIFIED | `prisma/settings-lov-seed-data.json` — seed-vs-workbook comparison not re-run; production values not read |
| SET-3 | Forms use settings-backed selects; inactive values excluded for new records | IMPLEMENTED BUT NOT VERIFIED | `SettingsSelect.tsx` + test; API excludes inactive unless `includeInactive=true` |
| SET-4 | Historical records keep displaying a later-deactivated value | NOT IMPLEMENTED (to confirm) | Values are stored as free strings; no referential handling seen |

## 10. Admin roles, permissions and audit

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| ADM-1 | Authentication: JWT access/refresh in httpOnly cookies, rotation, email verification, account setup | IMPLEMENTED BUT NOT VERIFIED | `auth.*`, `jwt.test.ts`, `auth-*.test.ts`; `/portal` and `/admin` gated by cookie in `proxy.ts` (shell only). Phase 4 F1, fixed in `b54e713`: suspending a user now ends their session — `authenticate` re-checks status and role on every request, `refresh()` refuses non-ACTIVE users, suspension revokes refresh tokens (13 unit tests; integration test passed on a disposable database) |
| ADM-2 | ADMIN/STAFF privilege boundary | PARTIALLY IMPLEMENTED | Phase 4 F5: every admin router allows STAFF and ADMIN equally except `GET /admin/settings/client-ip`; user create/edit adds an ADMIN guard for ADMIN accounts; department rules wait on the owner decision (§18.1) |
| ADM-3 | Department stored on users (Sales, Sourcing, Account, Logistic, Admin LOV) | IMPLEMENTED BUT NOT VERIFIED | `User.department`, `admin.users.routes.ts` |
| ADM-4 | Department-based EDIT/ADD vs VIEW permissions (workbook INDEX matrix: Super Admin all; Sales, Purchase, Account, Sourcing each with different edit/view sets) | NOT IMPLEMENTED | Department is stored but no route guard checks it. **Owner decision needed:** the matrix names a "Purchase" role that is not in the Department LOV, while the LOV has "Logistic" and "Admin" that are not in the matrix |
| ADM-5 | Audit log for sensitive mutations | PARTIALLY IMPLEMENTED | `auditInTx` (atomic) and fire-and-forget `audit()` exist; wide use across admin routes |
| ADM-6 | Audit redaction of secrets/PII | PARTIALLY IMPLEMENTED | Phase 4 F4, fixed in `af0f4b3`: `lib/audit.ts` now strips bank, credit and credential keys (at any depth) for every `audit()`/`auditInTx()` caller, which also closes the customer-portal company-update leak; 12 unit tests plus an integration test passed on a disposable database. **Open:** existing production `audit_logs` rows for `organization.*` and `company.updated` still hold the old values — scrubbing them needs your approval |
| ADM-7 | Admin user management | IMPLEMENTED BUT NOT VERIFIED | `admin.users.routes.ts` |

## 11. CRM / enquiry workflow

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| CRM-1 | Enquiry (Lead) list with server-side pagination/search/filters | IMPLEMENTED BUT NOT VERIFIED | `admin.leads.routes.ts`, `admin/leads/page.tsx`; filters covered by `admin-audit-and-filters.test.ts` (not run) |
| CRM-2 | Lead statuses NEW → CONTACTED → QUALIFIED → QUOTATION → WON/LOST; sources incl. CONTACT, REQUEST_QUOTE, BOM, CUSTOMER_PORTAL | IMPLEMENTED BUT NOT VERIFIED | enums in schema. The owner's "Enquiry Header/Line Status" LOV vs these enums — mapping not confirmed (§18) |
| CRM-3 | Convert lead to RFQ; vendor RFQ; vendor quotes; landed cost; customer quotation (create, send, PDF); customer accept/reject | IMPLEMENTED BUT NOT VERIFIED | `admin.leads` `convert-to-rfq`, `admin.vendor-rfqs`, `admin.landed-cost`, `admin.quotations`, `quotes.routes` |
| CRM-4 | Ownership: sales person / coordinator / sourcing owner assignment and visibility rules | PARTIALLY IMPLEMENTED | Fields exist on `Company` and `Lead.assignedToId`; rules for who may see/edit whose records are not specified by the owner (ties to ADM-4) |
| CRM-5 | Follow-up automation (Day 1/3/7/14, cancel on quote) | IMPLEMENTED BUT NOT VERIFIED | `follow-up-*` jobs, `follow-up-scheduler.test.ts`; in production it runs inside the API process (`server.ts`); its BullMQ part is affected by the Redis quota outage (Phase 4 F2) |
| CRM-6 | Email Log (timing, format) per workbook INDEX row 12 | PARTIALLY IMPLEMENTED | Per-lead notification status only; no general email log |
| CRM-7 | Dashboard/reports: today's enquiries, open tasks, enquiries this month, revenue this month, revenue target | NOT IMPLEMENTED | `admin/page.tsx` has no such KPIs (grep) |
| CRM-8 | Task management / to-do with delegation and reminders (1st stage) | NOT IMPLEMENTED | No model or route |

## 12. Performance, caching, Redis and queues

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PERF-1 | Redis caching of public catalogue with version-bump invalidation; best-effort | IMPLEMENTED BUT NOT VERIFIED | `catalog-cache.ts`, `catalog-cache.test.ts` |
| PERF-2 | Redis/BullMQ failures never take the API down | IMPLEMENTED BUT NOT VERIFIED | `redis-options.ts`; `bom-queue-health.test.ts` |
| PERF-3 | Database index/query-plan evidence | NOT IMPLEMENTED on this branch | Index work (`528fa71`) and later perf work live on `codex/scale-readiness`; not on `master` |
| PERF-4 | Overload behaviour (503 on DB pool exhaustion, metrics) | NOT IMPLEMENTED on this branch | same branch |
| PERF-5 | Rate limiting | IMPLEMENTED BUT NOT VERIFIED | `@fastify/rate-limit` plugin + per-route limits on public leads; in production the limiter sees the proxy address instead of the visitor (Phase 4 F3, see SEC-5) |

## 13. SEO, mobile, accessibility, security

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| SEO-1 | `sitemap.xml` and `robots.txt` | PARTIALLY IMPLEMENTED | Generated from `PUBLIC_PATHS` / `PRIVATE_PATHS` in `lib/site.ts` (17 static paths). **Product, manufacturer and category detail URLs are not in the sitemap by design** (comment in `site.ts`); `robots-sitemap.test.ts` exists; robots.txt and the 17-URL sitemap are served live (Phase 4) |
| SEO-2 | Per-page title, description, canonical, OG/Twitter | IMPLEMENTED BUT NOT VERIFIED | `pageMetadata()`; `site.test.ts` enforces metadata presence |
| SEO-3 | Admin/portal/auth kept out of search | VERIFIED | `X-Robots-Tag` + robots disallow; live `/admin` answers 307 → `/login` with `X-Robots-Tag: noindex, nofollow` (Phase 4) |
| SEO-4 | Branded 404 and error pages | IMPLEMENTED BUT NOT VERIFIED | `not-found.tsx`, `(public)/error.tsx`, `global-error.tsx` + tests; the branded 404 title was seen live (Phase 4), the error boundaries were not exercised |
| MOB-1 | Responsive at 375/390/768/1280/1440 | IMPLEMENTED BUT NOT VERIFIED | Not browser-tested this session (Phase 9); admin layout on phones unknown |
| A11Y-1 | Keyboard/ARIA basics, reduced motion, contrast | IMPLEMENTED BUT NOT VERIFIED | Combobox/Sheet/ARIA present; no automated audit run |
| SEC-1 | Security headers + CSP | VERIFIED | `next.config.ts`, `security-headers.test.ts`; CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy and HSTS seen live on `/` (Phase 4); CSP allows `'unsafe-inline'` scripts (documented tradeoff) |
| SEC-2 | Tenant isolation, role guards, input validation (Zod) | IMPLEMENTED BUT NOT VERIFIED | see §1/§10 |
| SEC-3 | Safe logging (no raw errors, redacted request URLs) | IMPLEMENTED BUT NOT VERIFIED | `safe-log.ts`, `no-raw-error-logging.test.ts`; request serializer drops query strings |
| SEC-4 | Dependency vulnerabilities | VERIFIED | `npm audit --omit=dev` reports 0 vulnerabilities in both projects on this branch (Phase 4); development dependencies not audited |
| SEC-5 | `trust proxy` configured for Render | NOT IMPLEMENTED | `TRUST_PROXY_HOPS="0"` in `render.yaml`, and the production request log shows a private proxy address as the client IP, so per-IP limits are shared across visitors (Phase 4 F3). Fixing it is a Render environment change that needs your approval |

## 14. Data model and API (summary)

- 28 Prisma models, 20 migrations. Roles: `UserRole` CUSTOMER / STAFF / ADMIN. Key models: User, Company, Customer, Rfq/RfqItem, Document, Lead/LeadItem, Vendor/VendorRfq/VendorQuote, LandedCost, Quotation/QuotationItem, FollowUp, Organization, Setting, Category, Product/ProductSource, CatalogImportRun, AuditLog, token models.
- ~111 route handlers under `/api/v1` (public: auth, leads, quotes, products, manufacturers, categories; authenticated: customers, rfqs, documents; admin/*).
- Migration gate: Render runs `prisma migrate deploy` on start, so any migration reaching `master` runs on production.
- Fresh-database migration application: NOT VERIFIED (Phase 9, disposable DB only).

## 15. Version 1 must-have (proposed — owner to confirm)

Proposed from the workbook INDEX "1st Stage" items **and** what is already live: public catalogue and search; Contact / Request Quote / BOM enquiries with reliable capture and notification; Customer, Vendor, Manufacturer, Product, Organization, User and Settings masters; RFQ Log (enquiry list/quote workflow); email log; RVL and L1-Price; import/export for master data; dashboard reports; task management; department permissions. Status of each is in §§2–13.

## 16. Later (workbook "2nd stage")

Email templates beyond RFQ; document templates (Pro Forma, Invoice, Packing Slip, COC, PO, Sales Order, Purchase Bill); Sales Tracker; Purchase Tracker; Reports (sales, stock, profit, enquiry); Inventory upload; Expense tracking; Customer portal enhancements; Calendar; Direct chat; DPASL. All **NOT IMPLEMENTED** on `master` and deliberately not started: `CLAUDE.md` forbids order/PO/invoice/shipment/financial work without owner-approved fields and rules. (The workbook marks "Customer Portal" as 2nd stage although a basic portal already exists.)

## 17. Explicitly out of scope until the owner says otherwise

Order, PO, invoice, shipment and any financial/ledger workflow; WhatsApp Business API; AI chatbot; marketing automation. Analytics/ads tags (GA4, Meta Pixel, LinkedIn, GTM, WhatsApp CTA) are **not in the KAS workbook**; an older roadmap lists them and they are NOT IMPLEMENTED (no matches in `compex-frontend/src`) — treat as owner-decision items, not Version 1 scope.

## 18. Unknowns and owner decisions required

1. **Department permissions** — confirm the INDEX role matrix is authoritative and reconcile "Purchase" vs the Department LOV (Logistic, Admin). Until then ADM-4 cannot be built.
2. **Enquiry status vocabulary** — owner "Enquiry Header/Line Status" LOV vs the `LeadStatus`/`RFQStatus` enums.
3. **RFQ Log margin formulas** (PV, SV, GM, GM%, Unit Price, Cost INR = Cost USD × rate) — confirm before any implementation; do not infer.
4. **RVL and L1-Price** — data shape beyond the sheets' headers, who may upload, how they relate to `Vendor`/`VendorQuote`.
5. **Customer "Both" (customer + vendor)** — one record or two linked records.
6. **Import/export** formats and sample files for Customer, Vendor, RVL, Enquiry.
7. **Menu behaviour** — Products panel open-on-hover vs click.
8. **Canonical domain** — custom domain for `NEXT_PUBLIC_SITE_URL`, and whether product/manufacturer URLs should be listed in the sitemap.
9. **Branch strategy** — which sibling-branch work (procurement/delivery workflow, CRM hardening, scale/index work, security patches) should land, in what order, given that its migrations hit production on deploy.
10. **Non-structured BOM formats** (PDF/Word/image) and any OCR/AI extraction — not specified by the owner.
11. **Mouser** — provider key/approval status (reported blocked 2026-09-07; current state unverified).
12. **Production mailbox delivery** — a controlled delivery test needs the owner's approval of the mailbox/time.
13. **Follow-up worker** — resolved in Phase 4: `server.ts` runs the background jobs inside the API process.
14. **Redis plan** — the production Redis quota is exhausted (BOM queue down); upgrading or another remedy is a billing decision (Phase 4 F2).
15. **Historical audit rows** — approve or decline a one-off scrub of bank and credit values already stored in production `audit_logs` (Phase 5, F4).
