-- DigiKey returned "Tools" for a batch of Amphenol circular connector SKUs.
-- Correct only those unambiguous connector product descriptions; leave actual
-- tools and all other categories untouched. The update is idempotent.
UPDATE "products" AS p
SET "category_id" = connector_category."id",
    "updated_at" = CURRENT_TIMESTAMP
FROM "manufacturers" AS m,
     "categories" AS current_category,
     "categories" AS connector_category
WHERE p."manufacturer_id" = m."id"
  AND current_category."id" = p."category_id"
  AND connector_category."name" = 'Connectors'
  AND m."name" = 'Amphenol Industrial Operations'
  AND current_category."name" = 'Tools'
  AND lower(COALESCE(p."description", '')) ~ '\mconnector\M[[:space:]-]+(plug|receptacle)\M';
