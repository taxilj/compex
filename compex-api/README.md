# compex-api

COMPEX B2B electronics sourcing platform API (Fastify + Prisma/PostgreSQL).

## Live catalog providers

The catalog-import pipeline supports bulk CSV/XLSX import and exact-MPN
lookups using the approved distributor APIs. The three live providers are:

- **Mouser** (MOUSER_API_KEY)
- **DigiKey** (DIGIKEY_CLIENT_ID, DIGIKEY_CLIENT_SECRET)
- **Element14** (ELEMENT14_API_KEY, ELEMENT14_STORE_ID)

The public exact-MPN lookup runs all three providers in parallel. Each provider
is failure-isolated and reports one of FOUND, NO_MATCH, ERROR, TIMEOUT, or
RATE_LIMITED. A clean no-result is returned only when all three report
NO_MATCH.

There is no fallback provider.

## Public data boundary

Public responses contain only factual product information: MPN, manufacturer,
description, category, image, datasheet, lifecycle, compliance, and technical
specifications. They never expose supplier pricing, stock, MOQ, lead time,
supplier URLs, internal notes, or raw upstream payloads.

## Caching

Redis caching is best-effort. Product facts and short-lived provider statuses
are cached separately. Provider errors are never cached as a no-result.
