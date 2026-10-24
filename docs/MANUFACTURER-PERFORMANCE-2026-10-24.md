# Manufacturer bounded pagination and performance - 2026-10-24

**Verdict: NOT READY as a deployed production release.** The measured frontend bottleneck is fixed and locally verified. Nothing was pushed or deployed. The separate intermittent production transport stall is still not attributable to a specific infrastructure layer.

## Confirmed cause and exact change

The production directory blocks rendering until an automatic loop finishes all 37 pages (3,682 manufacturers). The first uncached browser sample spent **43,580.3 ms** on that sequential chain, receiving **679,257 decoded bytes**. Every individual GET returned 200 and the slowest took 1,690.5 ms. A later normal navigation independently took 42,483 ms. This is a confirmed frontend request-logic bottleneck, even when every API request succeeds.

No individual GET fetched 3,682 rows: the API already enforced limit<=100. The defect was eagerly traversing every page, delaying the first usable result and multiplying exposure to a slow request. The old cancelled effect also continued its page loop after its consumer left.

The local change removes that loop. The directory requests page 1 with limit=100, shows the server total, and fetches another page only on Previous/Next. All manufacturers remain reachable across 37 pages, with 82 on the last page. Page and limit metadata retain their meaning; no top-N truncation or parallel request burst was introduced. Stable name/id ordering prevents tied names from moving arbitrarily between pages.

To retain full-catalogue search without downloading the catalogue, the public API now accepts a trimmed, case-insensitive q (maximum 100 characters), applies the same filter to data and total, and includes it in the existing catalogue cache key. Search is submitted by button or Enter and resets to page 1. Typing alone sends no requests. Letter anchors now explicitly jump within the displayed page. Native buttons, labelled input, live page status, loading skeleton, honest empty/error states and Retry remain accessible. Controls stay mounted during pagination.

Manufacturer list requests alone use a **5,000 ms** deadline, covering headers and body, and retry the same GET **once only for TIMEOUT**. Worst-case persistent timeout is approximately **10 seconds**, not 40. Other endpoints retain their original deadlines and uploads retain their longer budget. Concurrent identical reads still share one promise including its retry. Failures are not cached as success. Superseded responses cannot overwrite current results; StrictMode cleanup prevents a stale initial dispatch. No authentication, mutation retry, public DTO or migration behavior was weakened.

## Direct Render versus Vercel measurements

All public probes used GET /api/v1/manufacturers?page=N&limit=100. Only status, timing, byte count and pagination metadata were retained; no credentials or raw catalogue payloads were saved. Every page was measured separately through both routes.

| Page | Render total ms / bytes | Vercel total ms / bytes |
| --- | --- | --- |
| 1 | 2026 / 18244 | 1195 / 18244 |
| 2 | 1010 / 18505 | 1087 / 18505 |
| 3 | 993 / 19490 | 8485 / 19490 |
| 4 | 1603 / 19133 | 1052 / 19133 |
| 5 | 1012 / 18302 | 1070 / 18302 |
| 6 | 1264 / 18216 | 1059 / 18216 |
| 7 | 1042 / 18419 | 1033 / 18419 |
| 8 | 1004 / 18763 | 1274 / 18763 |
| 9 | 992 / 18136 | 1062 / 18136 |
| 10 | 1046 / 17977 | 1073 / 17977 |
| 11 | 1236 / 18178 | 1075 / 18178 |
| 12 | 988 / 18433 | TIMEOUT at 10002 ms / unavailable |
| 13 | 1981 / 18322 | 1611 / 18322 |
| 14 | 990 / 18442 | 1008 / 18442 |
| 15 | 1041 / 18652 | 1258 / 18652 |
| 16 | 999 / 18801 | 1038 / 18801 |
| 17 | 1002 / 18417 | 1049 / 18417 |
| 18 | 1253 / 18430 | 1078 / 18430 |
| 19 | 987 / 18696 | 1003 / 18696 |
| 20 | 1021 / 18433 | 1246 / 18433 |
| 21 | 723 / 18763 | 501 / 18763 |
| 22 | 554 / 18601 | 580 / 18601 |
| 23 | 555 / 18260 | 582 / 18260 |
| 24 | 571 / 17969 | 569 / 17969 |
| 25 | 570 / 18190 | 536 / 18190 |
| 26 | 523 / 18368 | 578 / 18368 |
| 27 | 522 / 18133 | 548 / 18133 |
| 28 | 486 / 18275 | 521 / 18275 |
| 29 | 830 / 18324 | 588 / 18324 |
| 30 | 573 / 18605 | 579 / 18605 |
| 31 | 570 / 18782 | 629 / 18782 |
| 32 | 559 / 19054 | 531 / 19054 |
| 33 | 511 / 18655 | 512 / 18655 |
| 34 | 484 / 18347 | 605 / 18347 |
| 35 | 568 / 18280 | 549 / 18280 |
| 36 | 564 / 18038 | 522 / 18038 |
| 37 | 526 / 14624 | 585 / 14624 |

The first measurement set comprised 92 GETs: all 46 Render GETs succeeded; 45/46 proxied GETs succeeded. Render successful range: 454-2026 ms (median 591). Vercel successful range: 45-8485 ms (median 585). Payloads were 14,624-19,490 bytes. One Vercel page-12 probe exceeded its separate 10-second measurement deadline; the direct page-12 probe had completed in 988 ms. This failure remains in the evidence and is not reclassified as success.

Five subsequent page-12 pairs all returned 200: Render 1009-1549 ms, Vercel 44-1221 ms; all bodies were 18,433 bytes / 100 rows. Successful retries do not establish the cause of the earlier stall.

After builds and checks passed, a final ten direct/proxy pairs all succeeded:

| Route | Success | Min / median / max total ms | Body bytes / rows |
| --- | --- | --- | --- |
| render | 10/10 HTTP 200 | 972 / 995.5 / 1878 | 18,244 / 100 |
| vercel | 10/10 HTTP 200 | 79 / 86.0 / 1256 | 18,244 / 100 |

Final responses preserved total=3682, page=1, limit=100. Full TTFB, total latency, byte counts and timestamps are in ignored api-probes.json, page12-repeat.json and final-api-pairs.json under compex-api/dist/manufacturer-performance-2026-10-24.

## Layer attribution and caching

- **Frontend request logic: confirmed.** Both source and live waterfall show 37 sequential pages before rendering. The fix reduces automatic directory calls from 37 to one. It does not claim a synthetic local response time as predicted production latency.
- **Wrong path, shape or pagination parameters: not found.** Correct list path, page=1..37, limit=100, envelope and totals were verified.
- **Caching exists.** Backend catalogue cache, HTTP s-maxage=30/stale-while-revalidate=120 and browser/edge caching were observed. Warm proxy GETs dropped to tens of milliseconds. No speculative cache rewrite was added.
- **Duplicate entries:** one browser hard-refresh trace contained 74 resource entries for 37 unique pages, including zero-transfer cached reads and network revalidation. This is not proof of two application dispatches. Other traces had 37 entries. Source-level in-flight deduplication is retained and tested.
- **Render logs:** read-only authenticated service logs showed req-1mbq (10:57:04-10:57:05 Asia/Calcutta) HTTP 200 in 726.777 ms and req-1mbr (10:57:05-10:57:06) HTTP 200 in 727.988 ms. Previously sampled requests were also under one second. No restart, shell, environment or deployment action was used.
- **Database versus serialization versus cold start/proxy:** the live logs give whole-request timing, not per-query/serialization spans, and omit pagination parameters. No correlation identifies the stalled proxy request. The exact source of that separate stall remains INCONCLUSIVE; a database, cold start, Redis or proxy cause is not asserted.

## Ten production browser loads after local checks

Each counted sample stayed on /manufacturers and rendered all 3682 links. Samples that navigated elsewhere or were incomplete were excluded. All completed directory resource entries below were HTTP 200. No unexpected console/network error appeared in these ten loads. Durations measure the directory request window, not navigation-to-paint.

| Run | Width | Action | Request window ms | Resource entries / unique pages |
| --- | --- | --- | --- | --- |
| 1 | 1440 | Normal link navigation | 42483 | 37 / 37 |
| 2 | 1440 | Hard refresh / cache revalidation | 229 | 74 / 37 |
| 3 | 390 | Normal reload | 3889 | 37 / 37 |
| 4 | 375 | Normal reload | 4085 | 37 / 37 |
| 5 | 768 | Normal reload | 3772 | 37 / 37 |
| 6 | 1280 | Normal reload | 4103 | 37 / 37 |
| 7 | 390 | Hard refresh | 4027 | 37 / 37 |
| 8 | 1440 | Normal reload | 3743 | 37 / 37 |
| 9 | 375 | Normal reload | 3901 | 37 / 37 |
| 10 | 1440 | Hard refresh | 3824 | 37 / 37 |

Run 2 used cached resources plus revalidation; its very short window is not a cold-origin speed claim. Most warm runs still spent roughly 3.7-4.1 seconds on unnecessary sequential requests. The existing production code is unchanged and still has the confirmed bottleneck.

A controlled browser-only timeout was safely reproduced by pausing only the manufacturer Fetch request in a disposable tab. The production page showed its real TIMEOUT/error and Retry button. Interception was cleared, Retry was manually clicked, and all 3682 manufacturers recovered. The expected injected TIMEOUT console entry is recorded separately from natural-load errors. No production infrastructure, settings or data changed. This tests existing deployed Retry behavior; it does not claim the new five-second code is deployed.

## Production-build local browser QA

Rebuilt Next production server: http://127.0.0.1:44101/manufacturers. Compiled worker-free API: loopback port 44100. Database compex_final_test and Redis container ownership were rechecked against D:/compex-delivery-clean; both bind to loopback. The API uses a newly generated SELECT-only QA role and process-only test credentials. Existing 3682 synthetic fixtures were used. No production database, fixture write, migration or schema change was performed in this task.

- 375, 390, 768, 1280 and 1440px: 100 links; total=3682; Page 1 of 37; no horizontal overflow.
- Initial local page: one GET, 102.9 ms, 19,297 decoded bytes. These are synthetic isolated-data measurements, not production speed predictions.
- Next/Previous and all transitions through page 37 were exercised. Final page: 82 links, Next disabled, correct total and no overflow.
- Full-catalogue search found Synthetic Manufacturer 3681 as one result, beyond page 1; clearing search returned to page 1.
- Controlled page-2 hang produced exactly two aborted attempts of 5006.9 and 5014.5 ms, then visible TIMEOUT/Retry on page 2. Releasing interception and clicking Retry recovered page 2 with 100 links.
- No unexpected local console/network errors; only the intentional TIMEOUT appeared during fault injection. Temporary interception, cache and viewport overrides were cleared.

## Validation and exit codes

| Check | Final exit / result |
| --- | --- |
| Regression before fix | 1 expected: 6 failed, 17 passed |
| Focused frontend regressions | 0: 23 passed |
| Full frontend tests | 0: 220 passed / 36 files |
| Full backend unit tests | 0: 359 passed / 51 files |
| Frontend typecheck | 0 |
| Backend typecheck | 0 |
| Frontend lint | 0: no errors, three pre-existing warnings |
| Backend lint | 0 |
| Frontend production build | 0 |
| Backend production build / Prisma generate | 0 |
| git diff --check / git diff --cached --check | 0 |
| Intended-payload secret patterns / staged allowlist | 0 |

Initial validation attempts exposed missing dummy unit-test configuration, an incorrectly scoped typecheck command and unsupported test selector typing. Those were corrected and the final complete checks passed. No production credentials or environment files were used to repair the test setup. Full integration suites were not repeated; backend route injection tests and real SELECT-only local database/browser queries cover this change.

## Intended commit contents

- compex-api/src/modules/catalog/manufacturers.routes.ts
- compex-api/test/unit/manufacturers.routes.test.ts
- compex-frontend/src/app/(public)/manufacturers/ManufacturersGrid.tsx
- compex-frontend/src/app/(public)/manufacturers/ManufacturersGrid.test.tsx
- compex-frontend/src/lib/api/client.ts
- compex-frontend/src/lib/api/client.test.ts
- compex-frontend/src/lib/api/manufacturers.ts
- docs/MANUFACTURER-PERFORMANCE-2026-10-24.md

The source, tests and this report are the only intended staged files. No .env, logs, generated output, dependencies, migrations or quarantine files are included. Only the delivery worktree was operated on; original checkout, quarantine, other worktrees, stashes and other branches were not touched.

## Release boundary

The frontend performance cause is confirmed and the bounded-pagination fix is locally verified. A definitive production READY verdict is withheld because production still runs the old all-page implementation and a separate intermittent transport stall remains unexplained. Later deployment must put the API search support in place before the frontend that uses q, followed by production checks of the exact deployed commits. No push, deploy or hosting-setting change was performed.
