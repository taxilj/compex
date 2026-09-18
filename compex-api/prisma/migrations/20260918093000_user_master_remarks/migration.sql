-- Owner User Master: retain free-form internal remarks separately from the
-- address and authentication fields. Existing users remain unchanged.
ALTER TABLE "users" ADD COLUMN "remarks" TEXT;
