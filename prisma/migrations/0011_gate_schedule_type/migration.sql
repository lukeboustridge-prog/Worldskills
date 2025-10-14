-- Create schedule type enum and extend gates with C-month metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GateScheduleType') THEN
    CREATE TYPE "GateScheduleType" AS ENUM ('Calendar', 'CMonth');
  END IF;
END
$$;

ALTER TABLE "Gate"
  ADD COLUMN IF NOT EXISTS "scheduleType" "GateScheduleType" NOT NULL DEFAULT 'Calendar',
  ADD COLUMN IF NOT EXISTS "cMonthOffset" INTEGER,
  ADD COLUMN IF NOT EXISTS "cMonthLabel" TEXT;

UPDATE "Gate" AS g
SET
  "scheduleType" = 'CMonth',
  "cMonthOffset" = template."offsetMonths",
  "cMonthLabel" = 'C-' || template."offsetMonths" || ' Month'
FROM "GateTemplate" AS template
WHERE g."templateKey" = template."key";
