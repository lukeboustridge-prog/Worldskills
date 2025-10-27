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

ALTER TABLE "Deliverable" DROP COLUMN "type";
DROP TYPE IF EXISTS "DeliverableType";

CREATE UNIQUE INDEX IF NOT EXISTS "Deliverable_skillId_key_key" ON "Deliverable"("skillId", "key");

-- Create application settings singleton table
CREATE TABLE "AppSettings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "competitionName" TEXT NOT NULL,
  "competitionStart" TIMESTAMP(3) NOT NULL,
  "competitionEnd" TIMESTAMP(3) NOT NULL,
  "keyDates" JSONB DEFAULT 'null',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_singleton" ON "AppSettings"((1));
