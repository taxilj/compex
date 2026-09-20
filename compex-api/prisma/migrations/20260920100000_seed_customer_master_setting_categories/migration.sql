-- Additive, idempotent data seed for the four Settings categories introduced by
-- the Customer Master feature. `prisma migrate deploy` does not run
-- prisma/seed.ts, and a category with zero rows never appears in the Settings
-- admin page (categories are derived from existing rows), so without these
-- rows the State / Relationship Type / Industry Segment / Business Type
-- dropdowns would be empty and every write supplying them would be rejected.
--
-- RELATIONSHIP_TYPE values come straight from the owner's Customer/Vendor/Both
-- field. The other three categories get only the "EDITABLE" placeholder row
-- already used by every other category in settings-lov-seed-data.json, so an
-- admin adds the real values from the Settings page -- no invented data.
-- ON CONFLICT DO NOTHING keeps this safe to re-run and never touches an
-- existing row.

INSERT INTO "settings" ("id", "category", "value", "sort_order", "is_editable", "is_active", "updated_at")
VALUES
  (gen_random_uuid(), 'RELATIONSHIP_TYPE', 'Customer', 0, true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'RELATIONSHIP_TYPE', 'Vendor',   1, true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'RELATIONSHIP_TYPE', 'Both',     2, true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'STATE',             'EDITABLE', 0, true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'INDUSTRY_SEGMENT',  'EDITABLE', 0, true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BUSINESS_TYPE',     'EDITABLE', 0, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("category", "value") DO NOTHING;
