# Integration Tests

These tests require a running PostgreSQL database and Redis instance.

## Setup

1. Start services: `docker compose up -d`
2. Apply migrations: `npm run db:migrate`
3. Run integration tests: `vitest --project integration`

## What is tested

- auth.test.ts: register, login, refresh, logout
- tenant-isolation.test.ts: Customer A cannot read Customer B RFQs (CRITICAL)
- rfqs.test.ts: RFQ lifecycle, item CRUD, submit
- bom-upload.test.ts: file type validation, size limits, document access control