# Database Migrations

## Migration History

| # | Name | Description |
|---|------|-------------|
| 001 | init | Initial schema + rfq_counter_seq sequence |

## Phase 1 Tables

- `users` — authentication + roles
- `companies` — tenant root entity
- `customers` — links user to company
- `rfqs` — RFQ lifecycle
- `rfq_items` — BOM line items
- `documents` — file metadata (BOM files, etc.)
- `refresh_tokens` — JWT refresh token rotation
- `email_verifications` — email verification tokens
- `audit_logs` — immutable action log

## Running Migrations

```bash
# Development (creates migration files)
npx prisma migrate dev --name <description>

# Production (applies pending migrations)
npx prisma migrate deploy

# Reset dev DB (destructive — wipes all data)
npx prisma migrate reset
```

## RFQ Counter Sequence

Migration 001 creates `rfq_counter_seq` (PostgreSQL sequence).
Used by `nextRfqNumber()` in `src/modules/rfqs/rfq-number.ts` for concurrency-safe RFQ numbering.

Format: `RFQ-{YYYY}-{000001}`

## Adding Future Tables (Phase 2+)

```bash
# Edit prisma/schema.prisma, then:
npx prisma migrate dev --name add_vendor_tables
```

Prisma generates the SQL diff automatically.