-- Nullable for existing documents; new portal uploads persist their scoped
-- idempotency identity and content fingerprint on the document itself.
ALTER TABLE "documents"
  ADD COLUMN "upload_key" TEXT,
  ADD COLUMN "content_sha256" TEXT;

CREATE UNIQUE INDEX "documents_upload_key_key" ON "documents"("upload_key");
