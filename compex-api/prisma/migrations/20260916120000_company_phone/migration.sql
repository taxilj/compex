-- Adds the owner's Customer Master "Phone" field for companies. This is an
-- additive, nullable column -- no existing column is renamed, retyped, or
-- dropped, and no existing row requires backfill. Distinct from
-- users.phone (the portal login contact's own phone number), which already
-- exists and is unaffected by this migration.

ALTER TABLE "companies" ADD COLUMN "phone" TEXT;
