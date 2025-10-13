-- Create gate template catalog if it doesn't exist
CREATE TABLE IF NOT EXISTS "GateTemplate" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "offsetMonths" INTEGER NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed canonical gate templates
INSERT INTO "GateTemplate" ("id", "key", "name", "offsetMonths", "position") VALUES
  ('gate_tpl_KickoffAlignment', 'KickoffAlignment', 'Kick-off alignment', 10, 1),
  ('gate_tpl_ValidationWorkshop', 'ValidationWorkshop', 'Validation workshop', 4, 2),
  ('gate_tpl_FinalSignoff', 'FinalSignoff', 'Final sign-off', 1, 3)
ON CONFLICT ("key") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "offsetMonths" = EXCLUDED."offsetMonths",
  "position" = EXCLUDED."position",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Ensure gates can reference templates
ALTER TABLE "Gate"
  ADD COLUMN IF NOT EXISTS "templateKey" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'Gate'
      AND constraint_name = 'Gate_templateKey_fkey'
  ) THEN
    ALTER TABLE "Gate"
      ADD CONSTRAINT "Gate_templateKey_fkey"
        FOREIGN KEY ("templateKey") REFERENCES "GateTemplate"("key")
        ON UPDATE CASCADE
        ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill template keys for existing gates where possible
WITH mappings AS (
  SELECT * FROM (
    VALUES
      ('Kick-off alignment', 'KickoffAlignment'),
      ('Kickoff alignment', 'KickoffAlignment'),
      ('Validation workshop', 'ValidationWorkshop'),
      ('Final sign-off', 'FinalSignoff'),
      ('Final sign off', 'FinalSignoff')
  ) AS t(name, key)
)
UPDATE "Gate" AS g
SET "templateKey" = m.key
FROM mappings AS m
WHERE LOWER(g."name") = LOWER(m.name)
  AND g."templateKey" IS NULL;

-- Invitations for user onboarding
CREATE TABLE IF NOT EXISTS "Invitation" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'SCM',
  "isAdmin" BOOLEAN NOT NULL DEFAULT false,
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "acceptedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX IF NOT EXISTS "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'Invitation'
      AND constraint_name = 'Invitation_createdBy_fkey'
  ) THEN
    ALTER TABLE "Invitation"
      ADD CONSTRAINT "Invitation_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id")
        ON UPDATE CASCADE
        ON DELETE SET NULL;
  END IF;
END $$;
