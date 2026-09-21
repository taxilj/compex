-- Keep the deployed Settings table aligned with the owner workbook. The
-- application seed is idempotent, but production deploys run migrations
-- without necessarily running prisma/seed.ts.
INSERT INTO "settings" ("id", "category", "value", "sort_order", "is_editable", "is_active", "updated_at")
VALUES
  (gen_random_uuid(), 'DEPARTMENT', 'Sourcing', 1, true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DEPARTMENT', 'Admin', 5, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("category", "value") DO NOTHING;
