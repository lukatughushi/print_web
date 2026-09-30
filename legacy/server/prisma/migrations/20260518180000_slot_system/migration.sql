-- Clear any existing banner rows before adding the NOT NULL unique slotNumber column
DELETE FROM "Banner";

-- Add slotNumber as required unique field
ALTER TABLE "Banner" ADD COLUMN "slotNumber" INTEGER NOT NULL;
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_slotNumber_key" UNIQUE ("slotNumber");

-- Make imageUrl nullable (slots start empty)
ALTER TABLE "Banner" ALTER COLUMN "imageUrl" DROP NOT NULL;
