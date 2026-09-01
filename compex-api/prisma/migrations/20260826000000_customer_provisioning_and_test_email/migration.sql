-- Customer invitation/setup is additive. Existing customers and verification
-- records remain unchanged. Test email records are only written in NODE_ENV=test.

CREATE TABLE "account_setup_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_setup_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_setup_tokens_user_id_key" ON "account_setup_tokens"("user_id");
CREATE UNIQUE INDEX "account_setup_tokens_token_hash_key" ON "account_setup_tokens"("token_hash");
ALTER TABLE "account_setup_tokens" ADD CONSTRAINT "account_setup_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "test_emails" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "action_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "test_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "test_emails_to_created_at_idx" ON "test_emails"("to", "created_at");

CREATE TABLE "categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

CREATE TABLE "products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mpn" TEXT NOT NULL,
  "description" TEXT,
  "manufacturer_id" UUID,
  "category_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_mpn_key" ON "products"("mpn");
ALTER TABLE "products" ADD CONSTRAINT "products_manufacturer_id_fkey"
  FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
