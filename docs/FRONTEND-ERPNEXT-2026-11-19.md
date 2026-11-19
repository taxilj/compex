# COMPEX frontend and ERPNext handoff — 19 November 2026

## Owner-confirmed scope

The website's job is product discovery and online enquiries from Indian buyers, with export enquiries supported. ERPNext is the financial source of truth. A new ERPNext setup is in progress; its site URL, version and API connection have not been provided.

- Only **Compex Solution** bills. Its owner-supplied Gandhinagar address and GSTIN appear on Contact and the footer. The GSTIN has not been verified against live GST registration records.
- ERPNext supplies complete product HSN/rates, export tax treatment, official IRN/QR invoices, invoice numbers, templates, bank/signature details, opening balances, warehouses and accounting rules. Chapter 85 alone does not define a product's tax rate; no rate or legal invoice is invented here.
- Accountant: `account@compexsolution.com`, responsible for invoice issuance and payment recording/approval in ERPNext. Purchase verifies advances. PO creation must be blocked completely until advance payment is verified. These controls must be configured and tested in ERPNext before procurement goes live.
- Shree Maruti integration depends on API/account availability. No courier automation is claimed.

## Delivered source changes

- Homepage directs buyers to component search, quote enquiries and BOM submission. Manual enquiries require complete entered component rows and whole-number quantities; unfinished rows cannot silently disappear. Login, GSTIN and payment are not required to send an enquiry.
- Owner-confirmed legal identity is published without financial credentials. Contact labels are accessible. Failed submission retains form values and the idempotency key for retry.
- Existing catalogue/enquiry API remains the capture and notification service until a verified ERPNext handoff replaces it. Removing it now would break the website. No mock ERPNext sync or new finance backend is added.
- Unshipped standalone order/PO/invoice/shipment/payment code and its migration were archived. Active schema returns to 28 models and 21 migrations, retaining the additive BOM upload identity migration. Existing financial routes display a document/contact notice.
- Useful prior work remains: contact data round-trip, safe public URLs/data boundaries, audit redaction, partial-update preservation, quotation transition guards, BOM processing/upload retry fixes and dependency patches.

## Preservation and evidence

Ignored `.local-recovery/2026-11-19-frontend-erpnext/source-before.zip` contains 464 hash-verified source payloads before this transition. `retired-local-finance/` preserves the 17 retired files. Earlier recovery contains original worktrees, patches, reference documents and the Git history bundle. Never publish recovery: some earlier archives contain private environment files and uploads.

The 17 November commercial report is historical and superseded for active architecture. Its test counts must not be represented as current ERPNext or live production evidence.

## Release status

Local release gates passed: 379 backend unit tests, 235 frontend tests and all 171 serial integrations (785 total), backend/frontend type checks, lint (three existing frontend warnings), production builds, Prisma generation and fresh deployment of all 21 migrations. Both production dependency audits report zero vulnerabilities. Interrupted integration attempts were discarded; the completed run exited 0 in 149 seconds against newly provisioned task-owned PostgreSQL/Redis, not production.

Browser verification passed 63 checks across 21 public routes at widths 390, 768 and 1440: HTTP 200, one loaded H1, no horizontal overflow, no private test sentinel and no page exceptions. Product-to-enquiry prefill, anonymous manual enquiry, Contact, public two-row CSV processing and customer portal BOM-to-submitted-RFQ succeeded. A simulated lost response retained form data and replayed the same request key with HTTP 200 and the same record ID. Database assertions confirmed one record per enquiry, correct item counts, completed BOM documents and five messages in the local test email outbox. ADMIN, STAFF and CUSTOMER logins were synthetic; financial document notices showed no fabricated tables.

Preservation recheck verified all 464 backup payloads, all six existing environment-file hashes, 17 retired finance files, unchanged prior branch refs and the single canonical worktree. Private evidence lives under the dated ignored recovery folder.

Deployment is pending the reviewed source commit/push and exact-commit hosting verification. Production forms, supplier calls and real email delivery are not exercised by local QA. ERPNext integration remains pending its actual site/API and a secure mapping/handoff configuration. Passing website tests cannot establish ERPNext tax, invoice, payment or accounting correctness.
