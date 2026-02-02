-- Convert skillName to skillNames array and category to categories array

-- Add new array columns
ALTER TABLE "Descriptor" ADD COLUMN "skillNames" TEXT[] DEFAULT '{}';
ALTER TABLE "Descriptor" ADD COLUMN "categories" TEXT[] DEFAULT '{}';

-- Migrate data from old columns to new arrays
UPDATE "Descriptor" SET "skillNames" = ARRAY["skillName"] WHERE "skillName" IS NOT NULL;
UPDATE "Descriptor" SET "categories" = ARRAY["category"] WHERE "category" IS NOT NULL;

-- Drop the unique constraint that depends on skillName
ALTER TABLE "Descriptor" DROP CONSTRAINT IF EXISTS "Descriptor_skillName_code_key";

-- Drop old indexes
DROP INDEX IF EXISTS "Descriptor_skillName_idx";
DROP INDEX IF EXISTS "Descriptor_category_idx";

-- Drop old columns
ALTER TABLE "Descriptor" DROP COLUMN "skillName";
ALTER TABLE "Descriptor" DROP COLUMN "category";

-- Create GIN indexes for efficient array queries
CREATE INDEX "Descriptor_skillNames_idx" ON "Descriptor" USING GIN ("skillNames");
CREATE INDEX "Descriptor_categories_idx" ON "Descriptor" USING GIN ("categories");
