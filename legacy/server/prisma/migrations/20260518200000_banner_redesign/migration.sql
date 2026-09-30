-- Drop all existing banner rows (empty pre-seeded slots)
DELETE FROM "Banner";

-- Remove the old slot system columns
ALTER TABLE "Banner" DROP CONSTRAINT IF EXISTS "Banner_slotNumber_key";
ALTER TABLE "Banner" DROP COLUMN IF EXISTS "slotNumber";
ALTER TABLE "Banner" DROP COLUMN IF EXISTS "link";

-- New required imageUrl
ALTER TABLE "Banner" ALTER COLUMN "imageUrl" SET NOT NULL;

-- New columns
ALTER TABLE "Banner" ADD COLUMN "ctaText" TEXT;
ALTER TABLE "Banner" ADD COLUMN "ctaLink" TEXT;
ALTER TABLE "Banner" ADD COLUMN "order"   INTEGER NOT NULL DEFAULT 0;
