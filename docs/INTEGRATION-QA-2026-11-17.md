# COMPEX consolidation, archive review and local QA - 17 November 2026

Historical follow-up: [commercial workflow prototype](COMMERCIAL-DELIVERY-2026-11-17.md). The owner's later ERPNext decision supersedes that local finance implementation; [19 November frontend and ERPNext handoff](FRONTEND-ERPNEXT-2026-11-19.md) describes the active release and current QA.

- Canonical project: `D:\stitch_compex_sourcing_procurement_platform (1)`.
- Branch: `codex/delivery-canonical-2026-10-29`; original HEAD `0978d9e2cb6148bc9f2f4ae969c5d0d650e38e7e` retained. Changes are local and uncommitted. No push or deployment occurred.
- Result: consolidation complete; selected archive improvements integrated; local checks pass for the implemented scope. This is not acceptance of a complete commercial ERP or a production release.

## Preservation and cleanup

The four remaining C: worktrees were freshly snapshotted before removal:

| Codex worktree under `C:\Users\Asus\.codex\worktrees\` | Result |
| --- | --- |
| `audit-takeover` | Preserved and removed |
| `favicon-layout-repair` | Preserved and removed |
| `kas-crm-owner-mapping` | Preserved and removed |
| `owner-release-alignment` | Dirty work preserved and removed |

- All 2,270 retained file payloads were reverified against ZIP contents using SHA-256 after removal. Dirty patches, worktree Git metadata and the four parent-name markers are preserved.
- Git now lists only the canonical main worktree. All four former C: roots are absent; branch and stash refs remain intact.
- Fresh main-before ZIP/manifest preserves the pre-integration source, including existing uncommitted BOM changes. No baseline main file was deleted. Six existing environment files match their original hashes. Existing BOM edits and their tests remain intact; the shared plugin file also received the deliberate CSP change.
- The earlier seven D: worktrees and quarantine cleanup remain documented in [CLEANUP-2026-11-17.md](CLEANUP-2026-11-17.md).
- Private recovery locations: `.local-recovery/2026-11-17/` (original snapshots, history bundle, reference documents) and `.local-recovery/2026-11-17-integration/` (fresh C: snapshots, main-before backup, integration/QA evidence).
- Both are ignored by Git. They contain private configuration and business evidence. Do not upload, commit or deploy them.

## Archive review decisions

Archives were compared with the current source and branch-only changes. Older application trees were not copied wholesale over the newer main checkout.

| Archived work | Decision and reason |
| --- | --- |
| `hardening/crm-workflow`: numbering, email-log, quotation schema, RVL/L1 and admin-only mutations | Preserve the draft. Current code already has newer numbering/mail/quotation protections. The full CRM schema rewrite needs business acceptance and migration design. Its ADMIN-only policy conflicts with current tested STAFF permissions. |
| `hardening/production-readiness`, `codex/release-hardening`: SMTP retry, Redis, BOM, validation, security | Keep newer retry/recovery/ownership implementations. Integrate the small missing audit-redaction, public URL and API CSP protections. Update vulnerable runtime dependencies. |
| `codex/scale-readiness`: indexes, overload framework, search/cache and load scripts | Preserve performance drafts. Existing bounded catalogue pagination/search remains active. No production-sized query/load evidence justifies adding old indexes or another overload framework. |
| `codex/audit-takeover`: hardening, navigation, server rendering, integration serialization | Keep newer navigation/frontend behavior. Run integration files in a single fork against exclusively owned services. Avoid restoring overlapping older implementations. |
| `codex/kas-crm-owner-mapping`: contact fields and department schema | Integrate richer customer/vendor contacts through existing JSON storage and house form components. Preserve legacy role values. Do not add the older department schema solely to duplicate division/position fields. |
| `codex/owner-reference-alignment` and favicon/layout work | Keep current catalogue cache/search, BOM and branding where already superseded. Add the missing safe frontend error fallback. Preserve the broad order/procurement workflow draft. |
| Delivery/performance/stabilise snapshots and quarantine | Retain source drafts, configuration, uploads and evidence. Current applicable fixes are already represented in main; no blind cherry-pick or whole-directory restore. |

## Integrated behavior

- Customer/vendor contacts retain short name, email, phone/mobile, status, division, position, remarks and legacy role. Admin forms can add, edit and remove contacts with accessible labels. Unrelated edits do not resubmit unchanged contact arrays. Invalid updates preserve stored contacts.
- Audit payloads omit credential keys and sensitive commercial cost/account values, including normalized key spellings.
- Public catalogue URLs accept only bounded HTTP(S) URLs without embedded credentials. Fresh and cached search media use the same rule. Public search responses retain source status while omitting provider identities; useful public specifications remain visible.
- API responses carry a deny-all CSP appropriate to this JSON API. The frontend has a safe retry/home error fallback that does not render internal exception details.
- Runtime dependencies are pinned to Fastify 5.12.8, Nodemailer 10.6.0, Zod 4.6.7 and Next.js/eslint-config-next 16.4.6; vulnerable transitive fast-uri instances were updated in the lockfile. Zod 4 compatibility fixes preserve omitted PATCH amounts, currency and setting flags rather than reapplying creation defaults.
- A real portal BOM race was reproduced: the wizard submitted before asynchronous parsing finished and received HTTP 422; retry could create another draft. The wizard now waits for its uploaded document to complete before submission. Failure/timeout exposes the saved RFQ link, prevents duplicate wizard retry, and leaving the page stops subsequent submission. Only supported CSV/XLSX files are offered. New form labels and quantity constraints are accessible.
- The portal now has a main landmark; the unsupported hardcoded Enterprise Tier claim was removed.

Regression coverage accompanies the contact, audit, URL/privacy/CSP, PATCH preservation, error fallback and BOM submission changes.

## Verified local QA

| Check | Result |
| --- | --- |
| Backend unit tests | 378 passed, 0 failed, 0 skipped |
| Frontend tests | 228 passed, 0 failed, 0 skipped |
| Full database integration suite | 171 passed, 0 failed, 0 skipped |
| Fresh Prisma migrations | All 21 applied successfully to disposable `compex_test` |
| Backend TypeScript and production compilation | Pass |
| Frontend ESLint | 0 errors, 3 pre-existing warnings |
| Next.js production build and final TypeScript check | Pass |
| `npm audit --omit=dev` in both packages | 0 known reported vulnerabilities |
| `git diff --check` and `git fsck --full --no-dangling` | Pass |
| Snapshot/main preservation assertions | Pass |

The full integration run includes real PostgreSQL transactions, BOM identity/idempotency and filesystem failure cases, contact roundtrips, PATCH preservation, enquiry notifications and six dedicated Redis failure/recovery cases. The private runner uses the same test globs with explicit environment isolation and a single integration fork; no production environment file is loaded for these runs.

Three existing lint warnings remain in `CategorySection.tsx`, `AuthContext.tsx` and `lib/api/client.ts`: a ref cleanup warning and two full-page navigation warnings. The authentication reload behavior was retained.

### Isolation and real storage/queue verification

- Database identity was proven before migrations: a new task-owned PostgreSQL container, `127.0.0.1:59569/compex_test`, zero initial public tables, tmpfs storage. This is separate from production and from older worktree containers.
- Two task-owned Redis instances were used: application queue on loopback port 59570 and destructive reliability tests on 59572. Docker server/Compose health and ownership labels were checked before use.
- Browser BOM tests used a fourth task-owned S3-compatible VersityGW container on loopback port 57677, a new synthetic QA bucket and freshly generated private credentials. The real application S3 upload/parser/download code ran; it was not replaced by a browser mock. HeadBucket and authenticated signed download passed, with downloaded bytes matching the original CSV.
- Email used the guarded test outbox only; recipients were synthetic `@invalid.test` addresses. No live SMTP, supplier account or production write was used.
- Temporary QA runtimes and all four task-owned containers are removed after evidence capture. Existing unrelated containers and volumes are preserved. See private `qa-cleanup.json` for the final ownership-checked result.

### Browser checks

| Area | Verified behavior |
| --- | --- |
| Public site | 21 routes returned HTTP 200; intended missing route returned 404; robots and sitemap returned 200 |
| Catalogue | Product pagination, exact-MPN search, safe public detail/specifications, manufacturer 100/6 pagination and filtered search |
| Responsive layout | Six public routes at 390/768/1440 px without root overflow; mobile menu open/Escape close; desktop home and mobile product visually inspected |
| Admin | Real fixture login; 15 admin routes loaded; vendor richer-contact edit/save/reload persisted |
| Staff/customer permissions | Staff customer/vendor administration retained; staff ADMIN-user creation and client-IP diagnostics denied; customer admin API denied and UI redirected to portal |
| Customer portal | Dashboard, RFQs, quotes and company pages loaded; new RFQ manual submission succeeded |
| Contact and manual quote | Real form submissions persisted one enquiry each and displayed success; test notifications persisted SENT |
| Public BOM | HTTP 202 upload, real S3/Redis processing, two identified components and SENT test notification |
| Portal BOM fix | Paused only the owned queue: UI remained submitting after HTTP 202. Resuming the queue produced exactly one SUBMITTED RFQ with two rows (quantities 5 and 7), one COMPLETED document and matching signed download |

An expired QA login required fresh sign-in during a later browser pass. A cold queue capability check initially reported unavailable and succeeded through the existing Check again action. These resolved observations and earlier failed/reproduction logs are retained alongside the final passing evidence.

## Limits and release status

- Local implementation/QA: **PASS WITH CONCERNS** for the implemented scope. Consolidation and this archive review are complete.
- Complete commercial ERP acceptance: **NOT ESTABLISHED**. Orders, purchase orders, invoices and shipments remain explicitly unavailable. The larger RVL/L1/CRM rewrite is preserved rather than silently enabled without a reviewed migration and owner acceptance.
- Production readiness/deployment: **NOT VERIFIED IN THIS RUN**. No live supplier quota/coverage, SMTP delivery, production storage/proxy configuration, production-sized load or deployed frontend/backend parity was tested. No code was committed, pushed or deployed.
- Automated tests and a zero production-dependency audit count do not establish that every business path or security property has been verified.

## Evidence and reproduction

Private `.local-recovery/2026-11-17-integration/` contains per-command result JSON/logs, the three test result files, dependency audits, browser evidence, `final-browser-db.json`, `final-preservation.json`, redacted ownership records and the local QA runner. Its README describes reproduction and recovery boundaries. Do not share the private folder wholesale.

Upstream references consulted for dependency changes and local QA storage: [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [Next.js advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Zod 4 migration semantics](https://zod.dev/v4/changelog), [VersityGW Docker documentation](https://github.com/versity/versitygw/wiki/Docker).
