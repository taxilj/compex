# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What COMPEX is

A B2B electronics sourcing platform. Public visitors browse a catalogue (categories, manufacturers, products, exact-MPN lookup) and send enquiries (Contact, Request Quote, BOM upload). Customers (`CUSTOMER`) use a portal for RFQs. Internal `STAFF`/`ADMIN` users run the admin/CRM side: customers, vendors, manufacturers, products, settings, enquiries and vendor RFQs.

Not a greenfield project: production data and owner-approved behaviour exist. Never invent owner requirements, CRM fields, dropdown values, manufacturers or product data; mark missing information as BLOCKED. Order/PO/invoice/shipment/financial workflows are intentionally not built (`compex-frontend/src/proxy.ts` redirects those routes) — do not start them without owner-approved fields and rules.

## Layout

Two independent npm projects (no workspace manager; the root `package-lock.json` is not used by either):

- `compex-api/` — Fastify 5 + Prisma 5 (PostgreSQL) + BullMQ/ioredis (Redis) + Zod. Deployed to Render.
- `compex-frontend/` — Next.js 16 App Router + React 19 + Tailwind 4. Deployed to Vercel.
- `render.yaml` (Render service definition — env var names only), `.github/workflows/` (CI + Render deploy hook), `docs/` and `compex-frontend/docs/` (historical owner-gap reports; they lag the code, so verify against source).

## Commands

Run from the project directory. Node 20 (CI uses 20).

```bash
# compex-api
npm install && npx prisma generate
npm run dev                  # tsx watch, needs .env (API default port 4000)
npm run worker               # standalone copy of the background jobs that server.ts already runs in-process
npm run typecheck            # `lint` is an alias for tsc --noEmit — there is no ESLint here
npm test                     # unit tests only (test/unit, no DB/Redis needed)
npx vitest run test/unit/bom-processor.test.ts            # single file
npx vitest run -t "name fragment"                          # single test by name
npm run test:integration     # needs disposable Postgres — see Integration tests below
npm run build                # prisma generate + tsc --noEmit + tsc -p tsconfig.build.json

# compex-frontend
npm install
npm run dev                  # needs NEXT_PUBLIC_API_URL (default http://localhost:4000/api/v1)
npx tsc --noEmit && npm run lint && npm test && npm run build     # CI gate (CI skips `npm test`; run it anyway)
npx vitest run src/lib/site.test.ts                        # single file
```

## Architecture

**Backend request path.** `src/server.ts` boots `buildApp()` in `src/app.ts`, which registers `src/plugins`, then every module under `/api/v1/*` (public: `auth`, `leads`, `quotes`, `products`, `manufacturers`, `categories`; authenticated: `customers`, `rfqs`, `documents`; `admin/*` for STAFF/ADMIN). The `/api/v1/test/*` email-outbox routes exist only when `NODE_ENV=test`. Modules follow `*.routes.ts` / `*.service.ts` / `*.schema.ts`. Writes that must be traceable go through `lib/audit.ts`; logging goes through `lib/safe-log.ts` (a unit test, `no-raw-error-logging`, enforces no raw error logging).

**Catalogue and the public data boundary.** `modules/catalog/public-dto.ts` is the only shape returned publicly: factual product data only — never supplier pricing, stock, MOQ, lead time, supplier URLs, internal notes or raw provider payloads. Exact-MPN lookup (`mpn-search-orchestrator.ts`, `product-on-demand.ts`) queries Mouser, DigiKey and Element14 in parallel, failure-isolated, each returning FOUND/NO_MATCH/ERROR/TIMEOUT/RATE_LIMITED; "no result" is reported only when all three say NO_MATCH, and provider errors are never cached as a no-result. There is no fallback provider. Product search is in `product-search.ts` (indexed/trigram-friendly queries — changing predicates can silently kill index use). Public catalogue responses are cached in Redis, invalidated by a version bump (`catalog-cache.ts`) triggered from the `onResponse` hook in `app.ts` after any successful admin catalogue write.

**Redis is best-effort, never a hard dependency for enquiries.** Cache and queue paths must degrade (fail-fast options in `lib/redis-options.ts`; the catalogue cache bounds each Redis call with `withTimeout` and trips a cooldown breaker). Enquiries/RFQs are saved to PostgreSQL *before* any email or queue work; email failure must not lose or block the saved record.

**BOM pipeline.** Upload (`modules/documents`) stores the file and enqueues a BullMQ job (`jobs/bom-processor.ts`). If the enqueue fails (Redis down/quota) the document stays `UPLOADED`; `jobs/bom-recovery.ts` re-enqueues stranded documents on an interval and retires superseded ones so a BOM is never appended twice. `jobs/follow-up-*` handle scheduled follow-up emails. In production `src/server.ts` starts the BOM worker, follow-up worker, BOM recovery and notification recovery **inside the API process**; `npm run worker` runs the same set standalone.

**Email.** `lib/email.ts` selects the transport via `EMAIL_PROVIDER` (`log` default, `smtp`, `resend`, or `test`, which feeds the test outbox and is rejected outside `NODE_ENV=test`). Website enquiries notify `ENQUIRY_NOTIFICATION_TO`; the customer's address is used as Reply-To. A failed notification leaves the lead `FAILED`; `jobs/notification-recovery.ts` re-sends it (every 10 min, up to 5 attempts within 3 days, Postgres only) and the admin Enquiries page flags what is still failed.

**Frontend.** App Router groups: `(public)`, `(auth)`, `admin/`, `portal/`. All API calls use same-origin `/api/v1/*`, rewritten server-side to `NEXT_PUBLIC_API_URL` (`next.config.ts`) so the API's httpOnly auth cookies are first-party. `src/proxy.ts` (Next 16's replacement for `middleware`) only gates the SSR shell on the `access_token` cookie — the API re-validates every call. API clients live in `src/lib/api/`; `src/data/mock` is legacy and must not back production screens. CSP and security headers are defined in `next.config.ts` (tested in `lib/security-headers.test.ts`). `admin/` and `portal/` are client-rendered and kept out of search via `X-Robots-Tag`.

**This is not the Next.js from training data.** `compex-frontend/AGENTS.md` (imported by `compex-frontend/CLAUDE.md`) requires reading `node_modules/next/dist/docs/` before writing Next.js code.

**Database.** `compex-api/prisma/schema.prisma` (28 models). `npm start` on Render runs `prisma migrate deploy`, so **any migration merged to master runs against the production database on the next deploy** — migrations must be additive/backward-compatible and reviewed before merge. Seeds: `db:seed`, `db:seed:qa`; settings dropdowns are seeded from `prisma/settings-lov-seed-data.json` and stored in the `Setting` table (settings reads exclude inactive values unless `includeInactive=true`).

## Integration tests (destructive)

`test/integration` runs one fork serially against a real Postgres and **resets the database**. Only run it against the dedicated throwaway DB from `compex-api/docker-compose.qa.yml` (`postgres-test`, database `compex_test`, port 5433, password supplied outside source control), with `NODE_ENV=test`, `EMAIL_PROVIDER=test`, `ALLOW_INTEGRATION_DB_RESET=true` set only in that process, after `prisma migrate deploy` against it. Redis for queue tests: the `redis` service in the same compose file. CI does not run integration tests because the only known `DATABASE_URL` points at production — never point them at it.

## Deployment

- **Frontend:** Vercel project `compex-frontend` (production alias `compex-frontend.vercel.app`), built from GitHub `master`.
- **Backend:** Render web service `compex-api` (`rootDir: compex-api`, region Oregon, health check `/health`). Pushes to `master` touching `compex-api/**` trigger `.github/workflows/deploy-render.yml` (Render deploy hook; Render's own auto-deploy webhook has been unreliable).
- `render.yaml` lists env var *names* only (`sync: false` = value lives in Render). Secret values are never read, printed or committed.

## Protected files and worktrees

Many sibling worktrees and branches exist (`git worktree list`: `D:/compex-*`, `~/.codex/worktrees/*`, plus the original `D:/stitch_compex_sourcing_procurement_platform (1)` checkout, which holds uncommitted user work). Treat all of them as someone else's work:

- Work only in your own worktree/branch (current stabilisation work: `D:/compex-stabilise`, branch `codex/stabilise`, cut from `origin/master`).
- Never edit, stash, reset, clean or delete another worktree's files or branches. Do not use bare `git stash` (the stash stack is shared across worktrees).
- Never use `git reset --hard`, `git clean`, force push, or branch/worktree deletion.
- Never stage unrelated files: `.claude/`, `.playwright-mcp/`, `Claude outputs/`, `COMPEX-*.md` reports, `vitest.config.ts.timestamp-*.mjs`, `.next*` dirs and `_to_delete/` are local artefacts.

## Working rules

- Plan before any major change: read this file and `PRD.md` (once it exists), state the files to change and acceptance criteria, then implement the smallest safe change.
- Test every feature before committing: add or update the regression test with the fix, run the focused test, then typecheck/lint/build for the affected project(s).
- Commit only focused, working changes with conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`…). Review `git diff` for unrelated changes and secrets first. Do not push, deploy or open PRs without explicit approval.
- Use mocked providers and disposable databases/Redis for tests. Never use real DigiKey/Mouser/Element14, Gmail/SMTP, Resend or customer data in tests, and never submit forms on production.
- Never read, print, copy or commit values from `.env*`, Render, Vercel, supplier or mail credentials; inspecting variable *names* in redacted form is fine.
- Never change production data, DNS, billing, Render/Redis plans or deployment settings without explicit approval. Render plan/billing is checked last, read-only; never purchase anything.
- Do not claim a feature is complete without supporting code, tests and (where relevant) browser/API verification. Spreadsheet "Done" cells are not proof of live behaviour.
