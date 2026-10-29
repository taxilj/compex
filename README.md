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
- Orders, purchase orders, invoices and shipments show explicit unavailable states in this delivery baseline. The earlier workflow draft is preserved for recovery and is not approved for release.
- Local tests, builds and `/health` do not establish successful production email delivery, BOM processing, authenticated workflows or supplier-account readiness.
- Production references: [GitHub](https://github.com/taxilj/compex), [storefront](https://compex-frontend.vercel.app/), [API health](https://compex-api.onrender.com/health).
- Read [the canonical delivery report](docs/CANONICAL-DELIVERY-2026-10-29.md) before release. No push or deployment is authorized by this setup.

## Recovery

Preserve `D:\compex-quarantine-2026-10-23`. The 2026-10-29 reconciliation archive contains the original main-folder files, uncommitted patch, original refs/status and SHA-256 manifest. The original `codex/owner-reference-alignment` branch remains available. The duplicate-worktree recovery archive contains verified useful-file copies and removal records. Recovery files, environment files, local tooling and raw QA evidence are not release payloads.

Keep `.git`, `.claude`, `.engineering`, `.agents`, `.qa-infra`, owner documents and existing audit evidence. Do not run broad cleanup commands or remove generated directories without first checking for retained drafts or evidence inside them.
