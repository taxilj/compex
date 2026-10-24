# Manufacturer timeout recovery - 2026-10-24

**Verdict: NOT READY for definitive production-release certification.** The local recovery fix is verified and safe for review. Current production loads succeeded three times, but the origin of the earlier intermittent transport delay remains unproven, the new code is not deployed, and the production Retry button was not exercised because no current load exposed it. Do not interpret these results as three passing production Retry tests.

## Confirmed failure and smallest verified fix

The earlier production run reported `ApiError TIMEOUT` after the client's 20-second request deadline while loading the manufacturer directory. A directory requires 37 paginated GETs for 3,682 rows. Before this patch, `listManufacturers` abandoned a page on its first TIMEOUT; ManufacturersGrid then surfaced the error/Retry state instead of rendering an incomplete list. That error state was honest; it is preserved.

The confirmed local recovery gap is fixed in the shared public manufacturer-list client: retry the **same GET, once, only for ApiError TIMEOUT**, inside the existing shared in-flight promise. The original page/limit, 20-second per-attempt deadline, response parsing and final rejection remain unchanged. A persistent timeout still rejects after two attempts and reaches the existing visible error and manual Retry. Maximum timeout wait for one page is now approximately 40 seconds, rather than 20; there is no unbounded retry or increase to the underlying deadline. No automatic retry was added to mutations, validation errors, unrelated transports or authentication.

This is a verified transient-timeout recovery improvement, not proof that a network/provider fault was repaired. The exact layer that delayed the historical request could not be established. No Render, Vercel, CORS, proxy, Redis or database cause is invented below.

## Diagnosis by candidate cause

| Candidate | Evidence / conclusion |
| --- | --- |
| Frontend request construction / wrong API path | Requests use `/api/v1/manufacturers?page=N&limit=100`, matching the registered API. First and last page probes succeed directly and through Vercel. No wrong path found. |
| Response-shape mismatch | Both return `{ success, data, meta }`; meta includes total/page/limit, matching apiFetchPaginated. Rows contain the expected public fields and _count. No mismatch found. |
| Pagination bug | Page 1 returns 100 rows, total 3682; page 37 returns 82 rows with page=37 and limit=100. All 3682 links rendered on successful loads. No incorrect query construction, cap or premature truncation found. |
| Timeout | Confirmed historical client error: TIMEOUT at 20 seconds. The exact stalled request was reproduced with an abort-aware fetch in a regression before changing code. Missing bounded recovery was demonstrated by two failing tests. |
| CORS / proxy | Browser calls are same-origin, so browser-to-Render CORS is not involved. Direct and proxied first/final pages return matching shapes; final page response SHA256 is identical. This proves those rewrites work, not that an intermittent proxy/network delay is impossible. |
| Render / API / data | Service is Live at 71bec51; /health is 200. Sampled runtime requests in the prior failure window returned 200 in under a second. No correlated API/data failure was established. A separate Redis quota warning was visible; it is not evidence that Redis caused this manufacturer timeout. |

## Direct GET and rewrite evidence

| GET | Status | Body / timing |
| --- | --- | --- |
| https://compex-api.onrender.com/api/v1/manufacturers?page=1&limit=100 | 200 | 100 rows; meta 3682/1/100; 18,244 bytes; 1.637 s |
| https://compex-frontend.vercel.app/api/v1/manufacturers?page=1&limit=100 | 200 | Same shape, count and size; Vercel MISS; 1.635 s |
| https://compex-api.onrender.com/api/v1/manufacturers?page=37&limit=100 | 200 | 82 rows; meta 3682/37/100; 2.130 s |
| https://compex-frontend.vercel.app/api/v1/manufacturers?page=37&limit=100 | 200 | Same 82 rows/meta and exact body SHA256; Vercel MISS; 2.152 s |
| https://compex-api.onrender.com/health | 200 | `{status: ok}`; 1.010 s |

Final-page SHA256: `c9276d940bf3235faf90172f12449ea30f4dcef95a7edc2e85a29296f26a1d5b` on both endpoints. Responses are application/json; public cache control is `public, s-maxage=30, stale-while-revalidate=120`. No raw catalogue payload or credential was saved.

Local next.config.ts rewrites `/api/v1/:path*` to the API base plus the same path. The live GET comparisons verify query preservation through the deployed proxy. Secret-bearing hosting environment settings were not opened. Render MCP had no selected workspace; the already authenticated Chrome Render service page was used for scoped read-only logs instead, without selecting a workspace or changing account context.

## Render read-only logs

Inspected the existing `compex` workspace's `compex-api` service `srv-da4nvajm8hqs73d1dqd0`. The live commit link is `71bec5159bf914f2640e8a5916d55da87c7e25a2`.

Runtime log samples from 2026-10-24, Asia/Calcutta:

- req-1l8v: manufacturer GET at 10:16:12; HTTP 200 at 10:16:13, responseTime 939.510 ms.
- req-1l91: manufacturer GET at 10:16:33; HTTP 200 at 10:16:34, responseTime 984.907 ms.
- req-1la0: manufacturer GET at 10:18:39; HTTP 200 at 10:18:40, responseTime 755.916 ms.

These are sampled requests in the failure window. The logs omit pagination query parameters and do not provide a demonstrated mapping to the browser's historical aborted request, so they cannot identify its exact delayed page or exonerate every layer. Health logs were successful. Redis quota warnings concerned delayed BOM processing; no causal link to manufacturer loading was proved. No environment, shell, deploy, restart, scale, billing or data action was used.

## Three current production re-tests

| Check | Surface / action | Result | Production Retry result |
| --- | --- | --- | --- |
| 1 | Desktop, 1440 px, fresh manufacturer directory tab | PASS: 3682 links, no visible error; captured completed page responses 200 | Not offered after successful load |
| 2 | Mobile, 390 px, separate directory tab | PASS: 3682 links; captured pages through 37 completed 200; no console error | Not offered after successful load |
| 3 | Mobile, 390 px, additional directory load/reload | PASS: 3682 links, no visible error | NOT RUN: button not present |

Two samples that navigated away from the intended directory were excluded. Browser-side failure-injection attempts did not produce a usable application Retry state: an offline document test reached Chrome's network-error page, and API-blocking attempts still loaded the directory. They are excluded from the three natural-load results and are not represented as a passing production Retry check. The disposable offline tab was closed and temporary blocking/cache/device overrides were cleared. No browser failure injection changed production infrastructure or data.

The earlier run's two failed natural loads/Retry remain documented in FINAL-DELIVERY-2026-10-24.md. They are not erased by the current successes. The production root delay was not reproduced naturally during this pass; the exact TIMEOUT behavior and manual Retry recovery were reproduced locally in tests.

## Changed files

1. `compex-frontend/src/lib/api/manufacturers.ts` - one bounded retry for TIMEOUT on the same manufacturer-list GET, retaining in-flight deduplication and final error propagation.
2. `compex-frontend/src/lib/api/client.test.ts` - real abort/deadline regression, concurrent deduped recovery, persistent second timeout and in-flight release, and no retry for validation failures.
3. `compex-frontend/src/app/(public)/manufacturers/ManufacturersGrid.test.tsx` - exhausted TIMEOUT produces the visible Retry state; manual recovery loads every page, with no false empty result.
4. `docs/MANUFACTURER-TIMEOUT-2026-10-24.md` - this evidence report.

Inspected all public helper callers (directory, public header, marquee, product filters and admin product manufacturer options). The separately defined admin manufacturer CRUD helper is unchanged. No backend, schema, migration, environment file, dependency or business-workflow source changed. Existing unavailable commercial screens and catalogue filter fix remain intact.

## Tests / builds / exit codes

| Check | Exit / result |
| --- | --- |
| New stalled-request regression before fix | 1 expected; 2 failures, 16 passing |
| Focused client + existing grid tests after fix | 0; 21 passing (before the additional exact TIMEOUT UI case) |
| Final frontend full `npm.cmd test` | 0; 219 tests / 36 files |
| Frontend `npm.cmd run lint` | 0; zero errors, three existing warnings |
| Frontend `npx.cmd tsc --noEmit` | 0 |
| Frontend `npm.cmd run build` | 0 |
| Backend `npm.cmd run typecheck` | 0 |
| Backend `npm.cmd run lint` | 0 |
| Backend `npm.cmd run build` | 0 |
| Backend tests | NOT REPEATED: no backend changes; the prior local run's 352 unit and 125 integration passes are historical evidence, not new results |
| `git diff --check` / `git diff --cached --check` | 0 |
| Intended-payload secret patterns / staged path allowlist | 0; no matches or unexpected files |

An initial backend build failed because the task-owned running API held Prisma's Windows DLL (EPERM rename). Only that verified local process was stopped; the unchanged backend then built successfully. This was not a source failure or production operation. The final regression update changed tests only; production runtime code did not change after the successful frontend build. The three pre-existing lint warnings remain outside this fix.

## Production-style local browser QA

The rebuilt Next production server at `http://127.0.0.1:44101/manufacturers` uses an isolated local compiled API, not production data. A verified task-owned `compex_final_test` database was populated with 3682 synthetic manufacturer records (the existing one plus 3681 synthetic fixtures); no schema or migration was changed. The restarted worker-free API uses a generated test role with SELECT-only database access. Credentials exist only in process memory. The existing task-owned Redis and database ownership/loopback bindings were rechecked.

| Width | Rendered links | Root scrollWidth / clientWidth | Console / API |
| --- | --- | --- | --- |
| 375 | 3682 | 360 / 360 | No unexpected errors; observed GETs 200 |
| 390 | 3682 | 375 / 375 | Same |
| 768 | 3682 | 753 / 753 | Same |
| 1280 | 3682 | 1265 / 1265 | Same |
| 1440 | 3682 | 1425 / 1425 | Same |

All 37 local page requests were observed with HTTP 200, page=1..37 and limit=100. Search found the last synthetic manufacturer as a single result; clearing it restored the full list. Mobile layout was visually checked after repaint. No timeout was hidden as empty, no top-N truncation was introduced, and persistent timeout/Retry behavior is covered by the real deadline and UI regressions.

## Scope and remaining uncertainty

The local timeout recovery fix is verified. The source of the intermittent historical transport delay is still INCONCLUSIVE; current production lacks a naturally visible Retry state, and the new retry code cannot be verified deployed without separate approval. Therefore a definitive production READY verdict is withheld. The code is suitable for a local review commit, not a claim that infrastructure was repaired. A persistent slow service still produces a visible error after the bounded second attempt.

Only this delivery worktree was changed. The original checkout, other worktrees, stashes, branches and quarantine were not operated on. No push, deployment, production data change, production environment change, DNS, billing, hosting setting or credential inspection occurred. Local test process variables/fixtures are confined to disposable owned QA services. No secrets, .env files, generated output or logs are staged. Safe metadata/run logs remain ignored under `compex-api/dist/manufacturer-evidence-2026-10-24`.

## Later PR commands (not executed)

```powershell
Set-Location -LiteralPath 'D:\compex-delivery-clean'
git push -u origin codex/delivery-ready-2026-10-23
gh pr create --repo taxilj/compex --base master --head codex/delivery-ready-2026-10-23 --title 'Recover a manufacturer page once after a transient timeout' --body 'Retry only the same read-only manufacturer GET once after TIMEOUT. Preserve pagination, in-flight deduplication, deadlines and visible errors after persistent failure. Frontend tests: 219 passed; typechecks, lint and both builds pass. See docs/MANUFACTURER-TIMEOUT-2026-10-24.md for three current production loads, unavailable production Retry coverage and the unresolved source of the historical transport delay. No deployment performed.'
```

If a PR for this branch already exists, update/review that PR after the push instead of creating a duplicate. Do not merge/deploy or call production READY until the approved release and post-deploy checks establish the intended behavior.
