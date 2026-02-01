-- Add pg_trgm extension for similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create QualityIndicator enum
CREATE TYPE "QualityIndicator" AS ENUM ('EXCELLENT', 'GOOD', 'REFERENCE', 'NEEDS_REVIEW');

-- Add new columns to Descriptor table
ALTER TABLE "Descriptor" ADD COLUMN "qualityIndicator" "QualityIndicator" NOT NULL DEFAULT 'NEEDS_REVIEW';
ALTER TABLE "Descriptor" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Descriptor" ADD COLUMN "deletedBy" TEXT;

-- GIN index on tags array for efficient tag filtering
CREATE INDEX "Descriptor_tags_gin_idx" ON "Descriptor" USING GIN (tags);

-- GIN trigram index on criterionName for similarity matching
CREATE INDEX "Descriptor_criterionName_trgm_idx" ON "Descriptor" USING GIN ("criterionName" gin_trgm_ops);
