# COMPEX commercial workflow delivery - 17 November 2026

Historical prototype report. The owner's 19 November ERPNext decision supersedes this architecture; see [the current handoff report](FRONTEND-ERPNEXT-2026-11-19.md). Local finance source is archived and is not shipped.

- Canonical folder: `D:\stitch_compex_sourcing_procurement_platform (1)`.
- The four previously unavailable operational workflows are implemented and locally verified: Sales Orders, Purchase Orders, Shipments and Invoices/received-payment records.
- Changes remain local and uncommitted on `codex/delivery-canonical-2026-10-29`. Original HEAD `0978d9e2cb6148bc9f2f4ae969c5d0d650e38e7e`, branch/stash refs and existing user work are preserved. No push or deployment occurred.
- This follows [archive integration and QA](INTEGRATION-QA-2026-11-17.md) and supersedes its statement that these four workflows remain unavailable.

## Implemented behavior

1. Customer accepts a valid sent/viewed quotation. Acceptance, order line/pricing/tax snapshots and the creation audit commit together. Concurrent/repeated acceptance produces one order. Competing accept/reject decisions remain consistent. Expired and unsent quotations cannot be accepted.
2. Admin/Staff create vendor POs from order lines, entering currency, quantities and costs. Active allocations cannot exceed ordered quantities. Optional supplier-quote references must match vendor, RFQ line, currency and cost. Cancellation releases reservations.
3. Admin/Staff create partial/full shipments, optionally linked to a shipped/delivered PO. Tracking is editable until closure; carrier/tracking are required before dispatch. Forward status changes are guarded. Order shipped/delivered status follows the aggregate quantities across all lines.
4. Admin/Staff create a full-order draft invoice using agreed order values and a chosen due date. One active invoice is allowed per order. Unissued drafts, including cancelled drafts, stay private. Received partial/final payments have positive bounded amounts, unique references and retry protection. The server derives PARTIALLY_PAID/PAID and prevents overpayment. Zero-value invoices settle without a fabricated payment entry.
5. Customers read their own orders, tracking and issued invoices. Responses exclude vendor costs, procurement links, internal notes, request hashes and payment references. Cross-tenant requests return 404; customer admin access returns 403.

Admin has a paginated conversion control for earlier accepted quotations. The migration does not automatically backfill orders. An RFQ already ordered through a different quotation cannot produce another order silently.

- API-backed list/detail pages, creation/status/tracking/payment forms, dashboard/sidebar links and direct quotation-to-order links replace unavailable screens.
- Lists/selectors have pagination, status filters where applicable, loading/error/empty states and Retry. Request keys survive failed saves. Different data under an already-used PO/shipment key returns a conflict.
- Allocation, financial and status writes lock the parent order and commit their audit together. Invalid state jumps, closed-record reopening, excess allocations/payments and cancellation with active dependent records are rejected.
- Server money uses Decimal. Frontend formatting and recorded-payment/balance display use exact scaled integers, preserving four-decimal balances at the database limit without JavaScript Number rounding.
- Shared accessible Field/Button components and human-readable status badges are reused. Tables scroll inside their containers on narrow screens. Print summaries hide navigation/editing/payment controls.
- The obsolete unavailable component/tests and three unused commercial mock datasets were removed after backup verification.

## Source and migration

The reviewed archived `4e6965a` supplied the starting model/field structure. Unrestricted status updates, allocation races, duplicate billing risk and broad customer responses were replaced with guarded implementations; older application trees were not restored wholesale.

- Backend: `modules/orders/orders.service.ts`, `customer.orders.routes.ts`, `modules/admin/admin.orders.routes.ts`, app registration and customer quotation handoff.
- Frontend: `lib/api/orders.ts`, shared commercial components, four admin list/detail routes, three customer list/detail routes, quotation handoff, navigation, print CSS and status labels.
- Additive migration `20261117090000_commercial_workflows`: nine new models, bringing the schema to 37 models and 22 migrations. Existing model fields are preserved; relation fields are additive.
- SQL adds new tables/enums, FKs, numbering sequences, positive-value constraints and a partial unique index for one non-cancelled invoice per order. No DROP TABLE, DROP COLUMN or TRUNCATE occurs. Preserve the manual sequence/index SQL in later migrations; do not substitute production `db push`.
- Integration cleanup was extended in FK-safe order. Existing BOM upload-identity fields/migration and prior uncommitted BOM work remain intact.
- Runtime dependencies, package manifests and lockfiles are unchanged from the pre-commercial snapshot. A one-off formatter did not become a project dependency.

## Final QA

| Check | Result |
| --- | --- |
| Backend unit suite | 380 passed, 0 failed, 0 skipped |
| Frontend suite | 236 passed, 0 failed, 0 skipped |
| Full PostgreSQL integration suite | 182 passed, 0 failed, 0 skipped |
| Total | **798 passing tests** |
| Backend typecheck and production compilation | Pass |
| Frontend lint | 0 errors; 3 existing warnings |
| Next.js production build and TypeScript | Pass |
| Fresh isolated migration deployment | All 22 migrations applied |
| Production-dependency npm audits, both packages | 0 known reported vulnerabilities |
| Whitespace, Git integrity and preservation assertions | Pass |

New integration coverage exercises acceptance concurrency/audit rollback, quotation privacy/expiry, legacy conversion, competing quotations, PO/shipment reservation races, invalid supplier/line associations, state guards, partial delivery, private/cancelled drafts, bounded idempotent payments, zero-value invoices and tenant isolation. Existing BOM, email/recovery, Redis fault and master-data tests remain in the full suite.

Existing lint warnings remain in `CategorySection.tsx`, `AuthContext.tsx` and `lib/api/client.ts`: a ref-cleanup warning and deliberate full-page authentication navigation.

### Browser and persisted records

- Synthetic CUSTOMER accepted the quotation and followed the order link. Exactly one order persisted.
- ADMIN created a 10-unit PO at INR 75.25/unit, total INR 752.50, and progressed it through DELIVERED.
- ADMIN created, linked, dispatched and delivered the 10-unit shipment; the sales order reached DELIVERED.
- ADMIN issued an INR 1,180.00 invoice and recorded INR 300.10 plus INR 879.90 already-received synthetic payments. Invoice status became PAID, with exactly two payment entries and outstanding **0**. No funds moved.
- Direct PostgreSQL assertions confirmed one order/PO/shipment/invoice, exact values/quantities, timestamps, two payments and one creation audit per entity.
- Eight admin paths at 390/768/1440 px: 24 checks passed. Six customer paths at those widths: 18 checks passed. No root overflow or populated application error alert appeared.
- STAFF could read all four modules. Customer admin access was denied; internal fields were absent from customer order/shipment/invoice responses.
- Injected HTTP 503 produced an error rather than an empty invoice list; Retry restored the record.
- Print-media checks hid navigation/controls and retained the document. Synthetic PDF export succeeded; the mobile invoice was visually inspected. Final decimal-display changes were rechecked in the browser.
- Public home/product-list/detail smoke checks passed; the private specification sentinel stayed hidden.
- Expected 403/503 probes and selector/dialog harness retries are retained alongside final successful evidence, not presented as a clean production console session.

### Isolation and cleanup

Integration used only new task-owned PostgreSQL/Redis containers, synthetic credentials, explicit test/reset guards and one integration fork. Identity was proven before writes: empty loopback `compex_test`, separate from production. Redis fault tests had a separate disposable instance. A checked lock prevents seed/provision/runtime startup during destructive integration.

After interruption Docker was stopped and tmpfs data was lost. Only this task's four ownership-verified containers were recreated. All 22 migrations were reapplied to an empty database before fresh browser fixtures. The earlier full-suite tuple is in private `pre-resume-qa-ownership.json`; browser ownership is in `qa-ownership.json`.

The resumed browser stack used PostgreSQL `127.0.0.1:64097/compex_test`, Redis ports 64098/64100 and S3-compatible loopback port 54047. HeadBucket passed. Email was test-only; no live provider/SMTP account or production data was used. These ports become historical evidence after cleanup.

Temporary API/frontend processes and all four task-owned containers are removed after evidence capture, recorded in private `qa-cleanup.json`. Unrelated services, volumes, files and browser tabs remain untouched.

## Recovery and release limits

- `.local-recovery/2026-11-17-commercial/source-before.zip` and SHA-256 manifest preserve 451 pre-commercial source/configuration/documentation files. The prior binary-capable working patch and reviewed archived source are adjacent. Earlier worktree/history/environment recovery remains in the other two ignored recovery folders.
- Private `final-preservation.json` verifies the ZIP, expected changes/deletions, unchanged manifests/lockfiles and original environment/BOM preservation, HEAD/refs and single main worktree. Tests, browser/database assertions, audits and cleanup evidence remain local. Do not upload the private recovery folder.
- No production migration/backfill, external email, supplier transaction, real payment, commit, push or deployment occurred.
- Legal/GST invoice formats, accounting ledger/reconciliation, refunds/credit notes, gateway collection and external carrier/vendor automation remain outside these operational records. Print summaries do not establish statutory tax-invoice compliance.
- Prefixes use the earliest configured Organization, with SO/PO/INV fallbacks and SHP for shipments. Explicit issuer selection and legal-party snapshots need owner-approved rules before multi-entity/statutory billing.
- Other historical PRD owner-decision items, including department permissions and the broader RVL/L1 rewrite, retain their prior review status.

Release status: **local operational workflows verified; production/business acceptance not established**.
