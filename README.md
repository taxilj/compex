# COMPEX

Canonical repository: `D:\stitch_compex_sourcing_procurement_platform (1)`.

Use this folder for development, validation and delivery. Other retained checkouts are recovery or unfinished work; do not deploy from them or copy their application directories over this checkout.

## Project layout

- `compex-api/`: Fastify API, background jobs, Prisma schema, migrations, unit and integration tests.
- `compex-frontend/`: Next.js storefront, customer portal and administration UI.
- `docs/`: architecture, authorization, operational constraints and dated validation reports.
- `render.yaml` and `.github/workflows/`: checked-in deployment configuration. Changing local files does not prove that production was deployed.

## Local setup

Use Node.js and npm versions compatible with the package manifests. From each package directory, run `npm.cmd ci --include=dev`. Configure backend values using `compex-api/.env.example` through the owner's normal secure process. The frontend's `NEXT_PUBLIC_API_URL` must include the API prefix, for example `http://localhost:4000/api/v1`; this is a public endpoint, never a place for credentials. Never commit real `.env*` values or use production credentials for tests.

Backend checks, from `compex-api/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Backend lint currently runs the TypeScript checker. The backend build also runs Prisma generation. Neither is an integration or production acceptance test.

Frontend checks, from `compex-frontend/`:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd tsc --noEmit
```

Build before the final frontend typecheck so Next.js route types exist. Run database integration tests only after proving the target is a task-owned disposable local `*_test` database, with `NODE_ENV=test`, `EMAIL_PROVIDER=test`, and the explicit integration-reset guard. Use the serial integration configuration and a separate disposable Redis for destructive Redis reliability tests. See `compex-api/test/integration/README.md`. Never reuse another checkout's services based only on their port numbers.

## Delivery boundaries

- Public catalogue browsing, enquiry/RFQ handling, quotation and BOM code have automated coverage; production transactions require separate authorized acceptance evidence.
- ERPNext owns HSN/GST, official IRN/QR invoices, numbering, templates, bank details, opening balances, inventory and accounting. Only Compex Solution bills. Its new ERPNext setup is still in progress; this website does not claim an active connection.
- The website focuses on product discovery and enquiries without mandatory login, GSTIN or payment. The existing API captures catalogue, enquiries, RFQs and notifications until the ERPNext handoff is configured. Private financial pages show a contact notice; no parallel financial API is shipped.
- ERPNext must completely block PO creation before advance payment. Purchase verifies advances; the accountant records and approves payments. These are requirements for ERPNext configuration, not checks implemented by this frontend.
- Local tests, builds and `/health` do not establish successful production email delivery, BOM processing, authenticated workflows or supplier-account readiness.
- Production references: [GitHub](https://github.com/taxilj/compex), [storefront](https://compex-frontend.vercel.app/), [API health](https://compex-api.onrender.com/health).
- Current scope and release evidence: [frontend and ERPNext handoff](docs/FRONTEND-ERPNEXT-2026-11-19.md). The earlier commercial prototype was archived after the owner confirmed ERPNext ownership; its historical tests do not prove an ERPNext connection.
- Earlier provenance: [canonical reconciliation](docs/CANONICAL-DELIVERY-2026-10-29.md) and [archive integration](docs/INTEGRATION-QA-2026-11-17.md). Releases require explicit authorization; the current owner request includes QA, push and deployment.

## Recovery

The architecture transition is preserved in `.local-recovery/2026-11-19-frontend-erpnext/`: a verified 464-file source snapshot plus `retired-local-finance/`. Restore only reviewed individual files; do not reactivate the local finance prototype without a new requirement.

Recovery is consolidated under `.local-recovery/` in the dated `2026-11-17`, `2026-11-17-integration` and `2026-11-17-commercial` folders. The commercial folder adds the pre-implementation source backup and final QA evidence. These contain verified snapshots, uncommitted patches, Git metadata, the history bundle, reference documents, quarantine contents and the pre-integration main backup. The seven extra D: worktrees, quarantine and four C: Codex worktrees have been removed; Git lists only this main checkout. Branch refs remain available. See [the cleanup record](docs/CLEANUP-2026-11-17.md), [integration review](docs/INTEGRATION-QA-2026-11-17.md) and private recovery READMEs before restoring anything. Recovery contains private environment files and uploads; never stage, upload or deploy it. The root `.gitignore` excludes it.

Keep `.git`, `.claude`, `.engineering`, `.agents`, `.qa-infra`, owner documents and existing audit evidence. Do not run broad cleanup commands or remove generated directories without first checking for retained drafts or evidence inside them.
