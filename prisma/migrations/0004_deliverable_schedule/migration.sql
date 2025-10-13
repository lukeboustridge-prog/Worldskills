-- Add Admin role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'Admin';

-- Create new deliverable key enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'DeliverableKey'
  ) THEN
    CREATE TYPE "DeliverableKey" AS ENUM (
      'ITPDIdentified',
      'ITPDAgreementKickoff',
      'WSOSAlignmentPlanning',
      'TestProjectDraftV1',
      'ILConfirmationCPW',
      'MarkingSchemeDraftWSOS',
      'PrototypeFeasibilityReview',
      'ITPVQuestionnaireCompleted',
      'FinalTPMSPackage',
      'ValidationDocumentUploads',
      'SAGFinalReadyMAT',
      'PreCompetitionReadinessReview'
    );
  END IF;
END
$$;

-- Extend skills with sector metadata
ALTER TABLE "Skill" ADD COLUMN IF NOT EXISTS "sector" TEXT;

-- Extend deliverables with scheduling metadata
ALTER TABLE "Deliverable"
  ADD COLUMN IF NOT EXISTS "key" "DeliverableKey" DEFAULT 'ITPDIdentified'::"DeliverableKey",
  ADD COLUMN IF NOT EXISTS "label" TEXT DEFAULT 'Legacy deliverable',
  ADD COLUMN IF NOT EXISTS "cMonthOffset" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "cMonthLabel" TEXT DEFAULT 'C-0 Month',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "overdueNotifiedAt" TIMESTAMP(3);

UPDATE "Deliverable"
SET
  "key" = CASE "type"
    WHEN 'SAG' THEN 'SAGFinalReadyMAT'::"DeliverableKey"
    WHEN 'TestProject' THEN 'TestProjectDraftV1'::"DeliverableKey"
    WHEN 'MarkingScheme' THEN 'MarkingSchemeDraftWSOS'::"DeliverableKey"
    WHEN 'Validation' THEN 'ValidationDocumentUploads'::"DeliverableKey"
    WHEN 'MAT' THEN 'FinalTPMSPackage'::"DeliverableKey"
    WHEN 'CISUpload' THEN 'PreCompetitionReadinessReview'::"DeliverableKey"
    ELSE 'ITPDIdentified'::"DeliverableKey"
  END,
  "label" = CASE "type"
    WHEN 'SAG' THEN 'SAG Final Ready for MAT'
    WHEN 'TestProject' THEN 'Test Project Draft Version 1'
    WHEN 'MarkingScheme' THEN 'Marking Scheme Draft aligned to WSOS'
    WHEN 'Validation' THEN 'Validation and Document Uploads'
    WHEN 'MAT' THEN 'Final TP and MS Package'
    WHEN 'CISUpload' THEN 'Pre-Competition Readiness Review'
    ELSE COALESCE("label", 'Legacy deliverable')
  END,
  "cMonthOffset" = CASE "type"
    WHEN 'SAG' THEN 3
    WHEN 'TestProject' THEN 8
    WHEN 'MarkingScheme' THEN 7
    WHEN 'Validation' THEN 4
    WHEN 'MAT' THEN 4
    WHEN 'CISUpload' THEN 1
    ELSE COALESCE("cMonthOffset", 0)
  END,
  "cMonthLabel" = CASE "type"
    WHEN 'SAG' THEN 'C-3 Month'
    WHEN 'TestProject' THEN 'C-8 Month'
    WHEN 'MarkingScheme' THEN 'C-7 Month'
    WHEN 'Validation' THEN 'C-4 Month'
    WHEN 'MAT' THEN 'C-4 Month'
    WHEN 'CISUpload' THEN 'C-1 Month'
    ELSE COALESCE("cMonthLabel", 'C-0 Month')
  END;

UPDATE "Deliverable"
SET
  "label" = COALESCE("label", 'Legacy deliverable'),
  "cMonthLabel" = COALESCE("cMonthLabel", 'C-0 Month'),
  "cMonthOffset" = COALESCE("cMonthOffset", 0),
  "dueDate" = COALESCE("dueDate", CURRENT_TIMESTAMP);

ALTER TABLE "Deliverable"
  ALTER COLUMN "key" SET NOT NULL,
  ALTER COLUMN "label" SET NOT NULL,
  ALTER COLUMN "cMonthOffset" SET NOT NULL,
  ALTER COLUMN "dueDate" SET NOT NULL,
  ALTER COLUMN "cMonthLabel" SET NOT NULL;

ALTER TABLE "Deliverable"
  ALTER COLUMN "key" DROP DEFAULT,
  ALTER COLUMN "label" DROP DEFAULT,
  ALTER COLUMN "cMonthOffset" DROP DEFAULT,
  ALTER COLUMN "dueDate" DROP DEFAULT,
  ALTER COLUMN "cMonthLabel" DROP DEFAULT;

ALTER TABLE "Deliverable" DROP COLUMN IF EXISTS "type";
DROP TYPE IF EXISTS "DeliverableType";

-- Remove any duplicate deliverables that would violate the unique constraint
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "skillId", "key" ORDER BY "createdAt", "id") AS rn
  FROM "Deliverable"
  WHERE "key" IS NOT NULL
)
DELETE FROM "Deliverable"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "Deliverable_skillId_key_key" ON "Deliverable"("skillId", "key");

-- Create application settings singleton table
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "competitionName" TEXT NOT NULL,
  "competitionStart" TIMESTAMP(3) NOT NULL,
  "competitionEnd" TIMESTAMP(3) NOT NULL,
  "keyDates" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_singleton" ON "AppSettings"((1));
