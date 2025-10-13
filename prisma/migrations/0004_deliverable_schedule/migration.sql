-- Add Admin role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'Admin';

-- Create new deliverable key enum
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

-- Extend skills with sector metadata
ALTER TABLE "Skill" ADD COLUMN "sector" TEXT;

-- Extend deliverables with scheduling metadata
ALTER TABLE "Deliverable"
  ADD COLUMN "key" "DeliverableKey" DEFAULT 'ITPDIdentified',
  ADD COLUMN "label" TEXT DEFAULT 'Legacy deliverable',
  ADD COLUMN "cMonthOffset" INTEGER DEFAULT 0,
  ADD COLUMN "dueDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "cMonthLabel" TEXT DEFAULT 'C-0 Month',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "overdueNotifiedAt" TIMESTAMP(3);

UPDATE "Deliverable"
SET
  "key" = CASE "type"
    WHEN 'SAG' THEN 'SAGFinalReadyMAT'
    WHEN 'TestProject' THEN 'TestProjectDraftV1'
    WHEN 'MarkingScheme' THEN 'MarkingSchemeDraftWSOS'
    WHEN 'Validation' THEN 'ValidationDocumentUploads'
    WHEN 'MAT' THEN 'FinalTPMSPackage'
    WHEN 'CISUpload' THEN 'PreCompetitionReadinessReview'
    ELSE 'ITPDIdentified'
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

ALTER TABLE "Deliverable" DROP COLUMN "type";
DROP TYPE IF EXISTS "DeliverableType";

CREATE UNIQUE INDEX IF NOT EXISTS "Deliverable_skillId_key_key" ON "Deliverable"("skillId", "key");

-- Create application settings singleton table
CREATE TABLE "AppSettings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "competitionName" TEXT NOT NULL,
  "competitionStart" TIMESTAMP(3) NOT NULL,
  "competitionEnd" TIMESTAMP(3) NOT NULL,
  "keyDates" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_singleton" ON "AppSettings"((1));
