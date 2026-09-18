-- The public header reads its menu from the real Category table.  Previously
-- the production catalogue contained only two imported leaf categories, so it
-- could not satisfy the owner's request for a DigiKey-style main-category
-- menu.  Keep this migration additive and idempotent: it adds the approved
-- top-level taxonomy without fabricating products or manufacturer data.

DO $$
BEGIN
  -- The existing imported leaf is the public site's semiconductor root. Rename
  -- it only when the target name is not already present, preserving all of
  -- its linked products and any existing category IDs.
  IF EXISTS (SELECT 1 FROM "categories" WHERE "name" = 'Discrete Semiconductor Products')
     AND NOT EXISTS (SELECT 1 FROM "categories" WHERE "name" = 'Semiconductors') THEN
    UPDATE "categories"
      SET "name" = 'Semiconductors', "updated_at" = CURRENT_TIMESTAMP
      WHERE "name" = 'Discrete Semiconductor Products';
  END IF;
END $$;

INSERT INTO "categories" ("id", "name", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Automation & Control', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Cables, Wires', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Circuit Protection', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Connectors', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Electromechanical', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Enclosures, Hardware, Office', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Fans, Thermal Management', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'LED/Optoelectronics', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Passives', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Power', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'RF and Wireless', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Semiconductors', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Sensors, Transducers', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Test and Measurement', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Tools', 'Main product category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
