# COMPEX Phase 4 Audit — 2026-10-19

Scope: audit of `origin/master` @ `2cd4275` (worktree `D:\compex-stabilise`, branch `codex/stabilise`, +3 docs/ignore commits) against `PRD.md`. Report-only: **no source files were changed**. No integration tests, no production writes, no form submissions. Production access was read-only (public GETs, Render service/deploy/log reads, Vercel deploy metadata).

**Verdict for this phase: NOT READY to be called production-ready.** *(Phase 5 update at the end of this file: F1, F4 and F6 are fixed locally; the verdict stands because F2 and F3 need your approval and nothing is deployed.)* Code quality gates are green, but one authorization defect, one production capacity outage (Redis quota → BOM upload disabled) and a proxy/rate-limit misconfiguration are open. Details below.

## 1. Gates run (exit codes)

| Project | Check | Result |
|---|---|---|
| compex-api | `npm ci` | exit 0 |
| compex-api | `prisma generate` (placeholder env, no DB connection) | exit 0 |
| compex-api | `npm run typecheck` (also serves as lint — no ESLint in this project) | exit 0 |
| compex-api | `vitest run test/unit` | exit 0 — **38 files, 265 tests passed** |
| compex-api | `npm run build` | exit 0 |
| compex-api | `npm audit --omit=dev` | exit 0 — **0 vulnerabilities** (prod deps) |
| compex-frontend | `npm ci` | exit 0 |
| compex-frontend | `tsc --noEmit` | exit 0 |
| compex-frontend | `npm run lint` | exit 0 — 0 errors, **3 warnings** (`CategorySection.tsx:44` ref in cleanup; `AuthContext.tsx:50` and `lib/api/client.ts:99` use `window.location.href`) |
| compex-frontend | `npm test` | exit 0 — **31 files, 173 tests passed** |
| compex-frontend | `npm run build` | exit 0 — 60 static pages generated |
| compex-frontend | `npm audit --omit=dev` | exit 0 — **0 vulnerabilities** |

Not run (by instruction or because they need infrastructure): API integration tests (destructive, need disposable Postgres), BullMQ/Redis tests, fresh-migration test, browser QA at 375/390/768/1280/1440, keyboard/mobile-menu QA, dev-dependency audit, bundle secret scan. These stay open for Phase 9.

## 2. Production read-only observations

| Check | Result |
|---|---|
| Vercel prod commit / Render API code | `2cd4275` / `a8070ea` (identical `compex-api` tree) |
| `GET /health` | 200 `{"status":"ok"}` |
| `GET /api/v1/categories` | 200, **18 roots, max depth 1 (no children)** |
| `GET /api/v1/products?limit=3` | 200, total **803**, paginated; keys: `id,mpn,name,description,specifications,packageType,mountingType,lifecycleStatus,datasheetUrl,images,manufacturer,category` — none of the forbidden pricing/stock/supplier/internal keys |
| `GET /api/v1/manufacturers?limit=3` | 200, total **122** |
| `GET /api/v1/products/<listed MPN>` | 200, same public key set |
| `GET /api/v1/leads/bom-capability` | 200 **`{"available":false}`** |
| Frontend routes `/ /products /categories /manufacturers /request-quote /contact /tools/bom /robots.txt /sitemap.xml` | all 200 |
| `/admin`, `/portal` unauthenticated | 307 → `/login`, `X-Robots-Tag: noindex, nofollow` |
| Unknown route | 404 titled "Page Not Found \| Compex Solution" |
| Headers on `/` | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (2 yr, preload) present |
| `/products` | canonical + og:title present |
| `sitemap.xml` | 17 URLs (static pages only) |
| Render logs (last 7 days sample) | `[bom-worker] Redis quota-exceeded; queue processing is delayed` every 5 min; `[bom-queue] health probe failed: unavailable` |

Latency from this machine: 1.0–1.8 s for catalogue GETs, 3.8 s for `bom-capability` (that endpoint probes the queue). Single-sample, not a benchmark.

## 3. Findings (ranked)

| # | Sev | Finding | Evidence | Fix needs |
|---|---|---|---|---|
| F1 | **HIGH — FIXED in `b54e713`** | **Suspending a user does not cut off an existing session.** `refresh()` never reads `user.status`, and the admin PATCH that sets `SUSPENDED` does not revoke refresh tokens, so a suspended user can keep refreshing for the 30-day refresh lifetime. Login blocks SUSPENDED (`auth.service.ts:191`), so only new logins are stopped. The 15-min access token also carries role and is never re-checked (`middleware/authenticate.ts`). | `auth.service.ts:230-277`, `admin.users.routes.ts:164-185` | Code + regression test (check status in `refresh`/`authenticate`, revoke tokens on suspend). No approval needed beyond normal flow |
| F2 | **HIGH** (availability; **intermittent** — see §8) | **Production BOM upload is disabled.** Redis quota is exceeded, the queue health probe fails, so `bom-capability` reports `available:false`. The site is honest about it (good), but the feature owners asked for is effectively off. Catalogue reads also run slower while the Redis timeout path is hit. | Render logs above; `public-leads.routes.ts:32-38` | **Owner/billing decision on Redis plan (Phase 10, read-only until approved).** Code-side hardening (don't let a bad Redis slow reads) exists on sibling branches (`31599a5`, `f8db1f5`), not on master |
| F3 | **MED-HIGH** | **Client IP is the proxy, not the visitor.** `TRUST_PROXY_HOPS="0"` in `render.yaml`, and the production request log shows `remoteAddress: 10.26.239.2` (private address) for my public request. Rate limiting is keyed on `req.ip`, so the 5/min enquiry limit and 200/min global limit are shared across all visitors, and audit `ipAddress` values are useless. | `app.ts:42`, `plugins/index.ts:28-32`, `render.yaml`, Render log line for `GET /api/v1/leads/bom-capability` | Render env change (needs approval) after confirming hop count; code already supports it |
| F4 | MEDIUM — **FIXED in `af0f4b3`** (production history not scrubbed) | **Organization audit entries contain bank account, SWIFT/IFSC/MICR and routing code in clear text.** Vendor and customer routes strip bank fields before auditing; organization does not. | `admin.organizations.routes.ts:69,81` vs `admin.vendors.routes.ts:55-56`, `admin.customers.routes.ts:109-110` | Code + test (reuse the strip-pattern) |
| F5 | MEDIUM | **STAFF == ADMIN on almost every admin module.** Every admin router uses `requireRole("STAFF","ADMIN")`; only `GET /admin/settings/client-ip` is ADMIN-only. Only user create/edit has an ADMIN guard (STAFF cannot create or edit ADMIN accounts). STAFF can read all users, invite STAFF/CUSTOMER accounts, edit non-admin users (including email), edit Organization bank details, and change settings. The owner's department matrix is not enforced at all. | grep of `requireRole` (22 call sites) | **Owner decision first** (PRD §18.1), then code |
| F6 | MEDIUM — **FIXED in `10c33d9`** | **Failed enquiry notifications are never retried.** `notificationStatus=FAILED` is stored and shown in a table column, but nothing re-sends it and there is no retry button; a failed notification is only noticed if staff open `/admin/leads`. | `website-enquiries.service.ts:161-180`, `admin/leads/page.tsx:80` | Code + test; confirm desired behaviour |
| F7 | MEDIUM | **Organization code prefixes are stored but never used.** `customerCodePrefix`, `vendorCodePrefix`, `itemNoPrefix`, etc. appear only in the organization validator; no ID generator reads them. | grep (6 hits, all in `admin.organizations.routes.ts`) | **Owner decision** on numbering rules, then code |
| F8 | LOW | **Production taxonomy is 18 flat categories** (no hierarchy) versus the owner's 373-row Group → Category sheet. The recursive menu cannot be exercised on real data. | `/categories` response | Owner/data task (import), not a code bug |
| F9 | LOW | Sitemap lists 17 static URLs only; 803 product and 122 manufacturer pages are not discoverable via sitemap; no JSON-LD anywhere. | `lib/site.ts:12-16`; grep `ld+json` | Owner decision (PRD §18.8) |
| F10 | LOW | Legacy mock-data pages (`portal/orders`, `portal/invoices`, `portal/shipments`, `portal/saved`, `admin/invoices`) still ship in the build; `proxy.ts` redirects their routes, so they are unreachable when logged in via the proxy. | grep `data/mock`; build route table | Cleanup (delete or keep behind redirect) — low risk |
| F11 | LOW | 3 frontend lint warnings (see §1). | lint log | Trivial |
| F12 | INFO — **APPLIED** (`b8d65a4` and the PRD update) | **Documentation corrections found during the audit** (my own docs): (a) `CLAUDE.md` says the worker is a separate process — in production `server.ts` starts the BOM worker, follow-up worker and BOM recovery **inside the API process**, so PRD §18.13 is resolved; (b) PRD MST-6 should read NOT IMPLEMENTED; (c) PRD ENQ-6 is confirmed (no retry); (d) PRD NAV-7 is now evidenced (18 flat categories); (e) PRD SEC-4 can be updated: 0 prod vulnerabilities on master. | `server.ts:15-17` | Doc edits — I have **not** made them (report-only) |

Rejected/not findings: CSRF — cookies are `httpOnly`, `sameSite: lax`, `secure` in production, and mutations are POST/PATCH, so cross-site form posts are blocked by `Lax`; public DTO leak — none seen in sampled responses; secrets in tracked files — none found.

## 4. Requirement matrix — updates to PRD statuses

Only rows whose status changed or gained evidence are listed. All other PRD rows remain **IMPLEMENTED BUT NOT VERIFIED** (unit tests green, behaviour not re-proven live).

| ID | PRD status | Audit status | Evidence |
|---|---|---|---|
| CAT-2 | IMPL, not verified | **VERIFIED** (sampled endpoints) | Live list + detail JSON contain only the allowlisted keys; `public-dto.test.ts` green |
| CAT-5 / MFR-2 | IMPL, not verified | **VERIFIED** (API shape) | Live `meta` shows total/page/limit; UI pager exists (`products/page.tsx:250-265`) but not browser-tested |
| NAV-1 | IMPL, not verified | IMPL, not verified — **cannot be proven on real data** | Prod taxonomy is flat (F8) |
| NAV-7 | BLOCKED | **PARTIALLY IMPLEMENTED (data gap)** | 18 live categories vs 373-row owner sheet |
| ENQ-6 | PARTIAL | **NOT IMPLEMENTED** | F6 |
| ENQ-8 | IMPL, not verified | **VERIFIED** (reports honestly) | Live `available:false` while logs show Redis quota exceeded |
| ENQ-10 | IMPL, not verified | **PARTIALLY IMPLEMENTED in production** | Queue is down in prod; recovery cannot run (F2) |
| MST-6 | PARTIAL | **NOT IMPLEMENTED** | F7 |
| ADM-2 | IMPL, not verified | **PARTIALLY IMPLEMENTED** | STAFF==ADMIN almost everywhere (F5) |
| ADM-1 | IMPL, not verified | **PARTIALLY IMPLEMENTED** | F1 (suspension does not end sessions) |
| ADM-6 | PARTIAL | PARTIAL (narrowed) | Vendor/customer strip bank data; organization does not (F4) |
| SEO-1 | PARTIAL | **VERIFIED live, PARTIAL by design** | robots + 17-URL sitemap served |
| SEO-3 | IMPL, not verified | **VERIFIED** | `/admin` → 307 `/login` with `X-Robots-Tag: noindex, nofollow` |
| SEO-4 | IMPL, not verified | **VERIFIED** (404) | Branded 404 title live |
| PD-4 | IMPL, not verified | **VERIFIED** (canonical on `/products`) | live HTML |
| SEC-1 | IMPL, not verified | **VERIFIED** (live headers) | §2 |
| SEC-4 | BLOCKED | **VERIFIED for production deps** | 0 / 0 vulnerabilities; dev deps not audited |
| SEC-5 | PARTIAL | **NOT IMPLEMENTED in production** | F3 |
| PERF-5 | IMPL, not verified | IMPL, **but keyed on the wrong IP in production** | F3 |
| CRM-5 | IMPL, not verified | IMPL, not verified — **runs in the API process in prod** | `server.ts:15-17`; blocked while Redis quota is exhausted for BullMQ parts |
| QA-1 (new) | — | **VERIFIED** | §1: all backend and frontend gates exit 0 |

## 5. Not audited yet (honest gaps)

- Behaviour that needs a database: tenant isolation, admin filters/pagination, settings inactive values, migrations from scratch (Phase 9, disposable Postgres).
- Redis/BullMQ behaviour (Phase 9, disposable Redis).
- Real mail delivery to the company mailbox (needs owner-approved controlled test).
- Browser/responsive/keyboard/accessibility checks and console/network review.
- Per-route authorization table (which admin route is allowed for which role) beyond the module-level guards above.
- Render plan and billing (Phase 10, read-only, last).

## 6. Proposed next steps (for your decision)

1. **Fix F1 first** (suspension must end access) — small, testable, no owner input needed.
2. **F4** (strip bank fields from organization audit) — same pattern as vendors/customers.
3. **F6** (resend/visible alert for FAILED notifications) — confirm desired behaviour.
4. **F3 / F2** need your approval for Render env / Redis plan changes; I will not change them. I can first do the read-only plan check (Phase 10 item) on request.
5. Owner questions that block code: department permissions (F5), numbering prefixes (F7), taxonomy import (F8).

## 7. Phase 5 update — fixes on `codex/stabilise` (not pushed, not deployed)

| Finding | Commit | Change | New tests | Integration run (throwaway Postgres, all 20 migrations applied fresh) |
|---|---|---|---|---|
| F1 | `b54e713` | `authenticate` re-reads status and role on every request; `refresh()` refuses non-ACTIVE users and revokes their token family; suspending a user revokes their refresh tokens and writes a `user.sessions_revoked` audit row | 13 API unit | `admin-master-review-fixes` 11/11 |
| F4 | `af0f4b3` | one central redaction in `lib/audit.ts` (bank, credit and credential keys, any depth); it also closed a second leak, the customer-portal company update | 12 API unit | `admin-audit-and-filters` 8/8 |
| F6 | `10c33d9` | `jobs/notification-recovery.ts` (10-minute sweep, 5 attempts, 3-day window, Postgres only) started from `server.ts` and `worker.ts`; admin Enquiries shows Sent/Pending/Failed badges and a red banner | 14 API unit + 3 frontend | `notification-recovery` 4/4 |
| docs | `b8d65a4` | CLAUDE.md corrected: background jobs run inside the API process | — | — |

**Quality gates after the last change (all exit 0):** API typecheck; `vitest run test/unit` 45 files / 304 tests (was 265); API build; frontend `tsc`, lint (0 errors, the same 3 warnings as before), `npm test` 32 files / 176 tests (was 173), build. The new unit and integration test files were also type-checked with a temporary out-of-repo tsconfig, because the project `tsc` excludes `test/`.

**How the integration runs were done:** a throwaway Postgres 16 container from `docker-compose.qa.yml` in its own compose project on port 55439, with a generated password that was never written to disk or chat; torn down and checked after every run. Docker Desktop was started for this and is still running; the pre-existing `compex-api-postgres-test-1` and `compex-api-redis-1` containers were not touched.

### Still unverified
- The other integration files were **not** run. `authenticate()` now sits in front of every authenticated route, so the full integration suite should run before any release.
- Real SMTP delivery of a retried notification, the new admin badges in a browser (desktop and mobile), BullMQ/Redis behaviour, responsive and keyboard QA.
- Production: none of these fixes is deployed. Production still has F1, F4 (plus the old audit rows holding bank and credit values) and F6 until a release you approve.

### Remaining findings
| # | Needs | Next step |
|---|---|---|
| F2 Redis quota exhausted, BOM upload off | your billing decision | read-only Render/Redis plan check (Phase 10) |
| F3 limiter sees the proxy IP | Render environment change (approval) | set `TRUST_PROXY_HOPS` once the hop count is confirmed |
| F5 STAFF equals ADMIN almost everywhere | owner decision | department permission matrix (PRD §18.1) |
| F7 Organization prefixes unused | owner decision | numbering rules |
| F8 18 flat categories vs the 373-row sheet | owner / data task | taxonomy import |
| F9–F11 sitemap and JSON-LD, dead mock pages, 3 lint warnings | optional | low priority |

**Verdict after Phase 5:** unchanged — NOT READY for a production release (see §8 for the final position). The code defects F1, F4 and F6 are closed locally.

## 8. Phase 9 verification and two more fixes (2026-10-19, same branch, nothing pushed)

### New findings
| # | Sev | Finding | Status |
|---|---|---|---|
| F13 | MEDIUM | Admin **Settings** put a fixed 256px category list beside an editor that could not shrink, so at 375px the whole admin content area scrolled sideways and the value editor was cut off | **FIXED** in `ca7bbad` (class-contract test; verified in the browser at 375 and 768px) |
| F14 | LOW | Admin **RFQ list** header and filter bars used `-mx-8`/`px-8` while the layout only pads 16px on phones, so they overhung the viewport by 16px | **FIXED** in `e7b0746` (test; verified at 375 and 1280px) |
| F15 | LOW | **Vendor RFQs**: a `<select>` with long option text overhangs the content column by 37px at 375px; nothing is clipped | **FIXED** in `bd4e9a7` (`max-w-full` on the select, class-contract test; verified in the browser at 375/390/768/1280/1440) |
| F16 | MEDIUM | The Redis quota problem is **intermittent**: `bom-capability` returned `false` at 05:00 UTC, Render logged "quota-exceeded" every 5 minutes until about 11:31 UTC, and by 12:03 UTC the endpoint answered `true` six times in a row. BOM upload therefore switches on and off during the day. Render has no Key Value instance, so Redis is an external provider; idle BullMQ workers polling Redis are a probable command source (not verified) | **OPEN** — provider/billing decision (F2) |

### Verification results
- **Full API integration suite** on a throwaway Postgres: **18 files, 119 tests passed, exit 0**; all 20 migrations applied from scratch; container, volume and port removed afterwards. (The `[cache] … unavailable` log lines in that run are the intended no-Redis degradation.)
- **Dependency audit:** production dependencies **0 vulnerabilities** in both projects. Including dev dependencies: API 9 (3 moderate, 3 high, 3 critical) and frontend 17 (3 moderate, 12 high, 2 critical) — all in build/test tooling (vitest 2.x line and its vite/esbuild chain, the shadcn CLI, eslint-config-next). Fixes are major upgrades (vitest 5) and nothing here ships to production; left alone on purpose.
- **Client-bundle secret scan:** 76 files in `.next/static`, no provider, JWT, database, SMTP or S3 secret names; no `NEXT_PUBLIC_*` value inlined.
- **Browser QA** (built-in browser; production build of the frontend against the local API and a throwaway database, with Redis deliberately unreachable):

| Surface | 375 | 390 | 768 | 1280 | 1440 |
|---|---|---|---|---|---|
| Public, 10 routes: home, products, categories, manufacturers, request-quote, contact, tools/bom, product detail, login, 404 | pass | pass | pass | pass | pass |
| Admin, 7 key routes: dashboard, enquiries, RFQs, users, customers, products, settings | pass (after F13/F14) | pass | pass | pass | pass |
| Admin, 8 more routes: vendors, manufacturers, categories, organization, quotes, vendor RFQs, catalog import, catalog coverage | pass (F15 aside) | — | — | — | — |
| Customer portal: home, RFQs, new RFQ, quotes, company | pass | — | — | — | — |

  "Pass" = no page-level horizontal scroll and (public pages) exactly one `h1`. Tables inside `overflow-x-auto` wrappers and the Quotes tab bar scroll by design.
- **Interactions checked in the browser:** desktop Products menu (opens with the real categories, `aria-expanded`, Esc closes and returns focus to the trigger); header search (shows the matching product); mobile drawer (opens, lists categories, Esc closes); admin sign-in; Enquiries banner and Sent/Pending/Failed badges (F6); customer sign-in; `/portal/orders` redirects to `/portal`; **F1 end to end** — a signed-in customer was suspended through the admin API and the next page load landed on `/login`.
- **Console and network:** no unexpected errors. The "Framing … frame-ancestors 'none'" messages came from my own iframe test being blocked by the CSP (it works as designed); the 404s came only from deliberate visits to the 404 route.
- **Not covered:** an automated accessibility audit (axe/Lighthouse), other browsers, the secondary admin routes and the portal at widths other than 375, keyboard traversal of the mobile category accordions (the taxonomy is flat, so there are none), and any form submission (forbidden by the instructions).

### Production read-only recheck (2026-10-19 12:03 UTC)
Vercel production `2cd4275` READY and equal to `origin/master`; Render live deploy `a8070ea`; `/health`, categories, manufacturers, products, the public frontend routes, `robots.txt` and `sitemap.xml` all 200; `bom-capability` currently `available:true`.

### Render plan (read-only, checked last)
`compex-api`: instance plan `0.5c-512mb` (0.5 CPU / 512 MB, the Starter-class paid size, matching `render.yaml`), one instance, not suspended, auto-deploy from `master`, build plan `starter`. There are **no Render Postgres or Key Value instances**, so the database and Redis plans and quotas live with other providers and could not be seen. The billing and invoice page was not opened (it needs a dashboard login), so the price and payment state are **not verified**. Nothing was purchased, upgraded or changed.

### Final position
**NOT READY for a production release.** Closed locally: F1, F4, F6, F13, F14 (all tests green, nothing deployed). Open: F2/F16 and F3 need your approval (Redis plan, Render environment), F5/F7/F8 need owner decisions, F15 is cosmetic, and none of the fixes is deployed. The full integration suite and browser QA have now run.

## 9. Phase 10: remaining release work (2026-10-19, same branch, nothing pushed)

| # | Item | Result | Evidence |
|---|---|---|---|
| F3 | Proxy-aware rate limits | **Prepared, not applied.** Render's pages confirm Cloudflare plus Render balancers but not the hop count, so `TRUST_PROXY_HOPS` was not guessed. Tests show distinct IPs/buckets at the right count, the shared bucket at 0, and the spoof hazards at too-low/too-high counts; the global limiter also keys on IP because it runs before `authenticate` | `cfadb4d`, `docs/PROXY-RATE-LIMITS.md` |
| F2/F16 | Redis and BOM reliability | **Code behaves correctly under quota failure (measured on a disposable Redis); the quota is a provider decision.** 11 commands per 10 s with the breaker versus 153,258 without; idle workers cost about 0 commands (BullMQ defaults: 15 per 12 s); enqueue fails fast with the upload kept pending; the worker resumes by itself and processes once; the same jobId is queued once; a dead worker's job is redelivered. The remaining probable quota consumer is the catalogue cache (not proven) | `fd6ca8a`, `ef14cdd`, `docs/REDIS-BOM-RELIABILITY.md` |
| F8 | Category hierarchy | **BLOCKED on owner decisions.** The data exists (371 rows) but 33 names repeat against the unique `Category.name`, 8 live categories sit at other levels, HSN/HTS have no column, two schemes coexist. Read-only checker and tests added; nothing seeded | `4958789`, `docs/CATEGORY-HIERARCHY-IMPORT.md` |
| F7 | Organisation code prefixes | **Traced; owner decision needed.** 13 columns stored and editable, read by no generator; the owner gave prefix values but no numbering pattern | `bd4e9a7`, `docs/ORGANIZATION-CODE-PREFIXES.md` |
| F15 | Vendor RFQ select overhang | **Fixed** with a regression test; 0px overhang at 375px | `bd4e9a7` |
| F5 | STAFF permissions | **Audited and locked in; one owner decision open.** All 75 admin routes asserted for no token / CUSTOMER / STAFF / ADMIN / suspended; the test fails if a guard is narrowed (checked) | `1d953a8`, `docs/ADMIN-ROUTE-AUTHORIZATION.md` |
| Legacy audit rows | Exposure report and rehearsed scrub | **Report only.** No API route returns audit rows; scrub SQL rehearsed on synthetic rows; retention period is an owner decision; nothing run on production | `032f228`, `docs/LEGACY-AUDIT-ROWS.md` |

### Verification (all on this branch, nothing deployed)
- API: typecheck 0; unit **47 files / 323 tests** (CI placeholder environment); build 0.
- API integration on a fresh disposable Postgres plus a disposable Redis: **19 files / 124 tests**, all 20 migrations applied from scratch; both containers removed.
- Frontend: `tsc` 0; lint 0 errors, 3 warnings (unchanged baseline); **34 files / 179 tests**; production build 0.
- `npm audit --omit=dev`: 0 vulnerabilities in both projects. Secret scan of the branch diff: no secrets (one placeholder localhost test URL).
- Browser QA at 375/390/768/1280/1440: Vendor RFQs, `/`, `/admin/settings`, `/admin/rfqs` at all five widths; `/products`, `/request-quote`, `/admin`, `/admin/leads` (F6 banner visible) at 375; no page-level horizontal scroll anywhere. API log for the session: 76 responses, all 200, no 5xx.
- Not covered: the production behaviour of any change (nothing deployed), the real Render hop count, the real quota consumer, accessibility audit, other browsers.

### Final position
**NOT READY for a production release.** F3 is prepared but not applied (needs the measurement and your approval), F2/F16 depends on a provider decision, and F5 needs one owner decision. F7 and F8 are owner-decision items that do not block the release.
