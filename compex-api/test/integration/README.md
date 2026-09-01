# Integration Tests

These tests require a running PostgreSQL database and Redis instance.

## Setup

1. Start the dedicated `postgres-test` service with a password supplied outside source control. Its database name must remain `compex_test`.
2. Set `NODE_ENV=test`, `DATABASE_URL` to that dedicated database, `EMAIL_PROVIDER=test`, and `ALLOW_INTEGRATION_DB_RESET=true` only in the test process.
3. Apply migrations to that dedicated database.
4. Run integration tests: `npm run test:integration`.

The test email outbox exists only when `NODE_ENV=test`; it requires an authenticated STAFF or ADMIN request and is not registered in development or production. Never use a production database, email token, or credential for these tests.

## What is tested

- auth.test.ts: register, login, refresh, logout
- tenant-isolation.test.ts: Customer A cannot read Customer B RFQs (CRITICAL)
- rfqs.test.ts: RFQ lifecycle, item CRUD, submit
- bom-upload.test.ts: file type validation, size limits, document access control
