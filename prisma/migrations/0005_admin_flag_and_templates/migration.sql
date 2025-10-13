-- Add admin permission flag
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing admin assignments
UPDATE "User" SET "isAdmin" = true WHERE "role"::text = 'Admin';

-- Replace Role enum with base roles only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'Role'
  ) THEN
    CREATE TYPE "Role_new" AS ENUM ('SA', 'SCM');

    ALTER TABLE "User"
      ALTER COLUMN "role" DROP DEFAULT;

    ALTER TABLE "User"
      ALTER COLUMN "role" TYPE "Role_new"
      USING CASE
        WHEN "role"::text = 'Admin' THEN 'SA'::"Role_new"
        ELSE "role"::text::"Role_new"
      END;

    DROP TYPE "Role";
    ALTER TYPE "Role_new" RENAME TO "Role";
    ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'SCM'::"Role";
  ELSE
    CREATE TYPE "Role" AS ENUM ('SA', 'SCM');
    ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'SCM'::"Role";
  END IF;
END
$$;

-- Ensure all admins retain the SA role
UPDATE "User" SET "role" = 'SA' WHERE "isAdmin" = true;

-- Deliverable template catalog
CREATE TABLE IF NOT EXISTS "DeliverableTemplate" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "offsetMonths" INTEGER NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed canonical templates
INSERT INTO "DeliverableTemplate" ("id", "key", "label", "offsetMonths", "position") VALUES
  ('tpl_ITPDIdentified', 'ITPDIdentified', 'ITPD Identified', 12, 1),
  ('tpl_ITPDAgreementKickoff', 'ITPDAgreementKickoff', 'ITPD Agreement and Kick-off', 10, 2),
  ('tpl_WSOSAlignmentPlanning', 'WSOSAlignmentPlanning', 'WSOS Alignment and Initial Planning', 9, 3),
  ('tpl_TestProjectDraftV1', 'TestProjectDraftV1', 'Test Project Draft Version 1', 8, 4),
  ('tpl_ILConfirmationCPW', 'ILConfirmationCPW', 'IL Confirmation at CPW', 8, 5),
  ('tpl_MarkingSchemeDraftWSOS', 'MarkingSchemeDraftWSOS', 'Marking Scheme Draft aligned to WSOS', 7, 6),
  ('tpl_PrototypeFeasibilityReview', 'PrototypeFeasibilityReview', 'Prototype and Feasibility Review', 6, 7),
  ('tpl_ITPVQuestionnaireCompleted', 'ITPVQuestionnaireCompleted', 'ITPV Questionnaire Completed', 5, 8),
  ('tpl_FinalTPMSPackage', 'FinalTPMSPackage', 'Final TP and MS Package', 4, 9),
  ('tpl_ValidationDocumentUploads', 'ValidationDocumentUploads', 'Validation and Document Uploads', 4, 10),
  ('tpl_SAGFinalReadyMAT', 'SAGFinalReadyMAT', 'SAG Final Ready for MAT', 3, 11),
  ('tpl_PreCompetitionReadinessReview', 'PreCompetitionReadinessReview', 'Pre-Competition Readiness Review', 1, 12)
ON CONFLICT ("key") DO UPDATE
SET
  "label" = EXCLUDED."label",
  "offsetMonths" = EXCLUDED."offsetMonths",
  "position" = EXCLUDED."position",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Prepare deliverables for new foreign key
DROP INDEX IF EXISTS "Deliverable_skillId_key_key";

ALTER TABLE "Deliverable"
  ALTER COLUMN "key" TYPE TEXT USING "key"::text;

-- Remove obsolete enum
DROP TYPE IF EXISTS "DeliverableKey";

-- Add relation to templates
ALTER TABLE "Deliverable"
  ADD CONSTRAINT "Deliverable_key_template_fkey"
    FOREIGN KEY ("key") REFERENCES "DeliverableTemplate"("key")
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- Refresh deliverable metadata from templates when possible
WITH settings AS (
  SELECT "competitionStart" FROM "AppSettings" WHERE "id" = 1
)
UPDATE "Deliverable" AS d
SET
  "label" = t."label",
  "cMonthOffset" = t."offsetMonths",
  "cMonthLabel" = 'C-' || t."offsetMonths" || ' Month',
  "dueDate" = CASE
    WHEN EXISTS (SELECT 1 FROM settings)
      THEN (SELECT "competitionStart" FROM settings) - make_interval(months => t."offsetMonths")
    ELSE d."dueDate"
  END
FROM "DeliverableTemplate" AS t
WHERE d."key" = t."key";

-- Restore unique index
CREATE UNIQUE INDEX IF NOT EXISTS "Deliverable_skillId_key_key" ON "Deliverable"("skillId", "key");
