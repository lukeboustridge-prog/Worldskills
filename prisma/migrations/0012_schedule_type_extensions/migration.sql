-- Extend gate and deliverable templates with schedule types and optional calendar dates
ALTER TABLE "GateTemplate"
  ADD COLUMN IF NOT EXISTS "calendarDueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduleType" "GateScheduleType" NOT NULL DEFAULT 'CMonth';

ALTER TABLE "GateTemplate"
  ALTER COLUMN "offsetMonths" DROP NOT NULL;

UPDATE "GateTemplate"
SET "scheduleType" = 'CMonth'
WHERE "scheduleType" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliverableScheduleType') THEN
    CREATE TYPE "DeliverableScheduleType" AS ENUM ('Calendar', 'CMonth');
  END IF;
END
$$;

ALTER TABLE "DeliverableTemplate"
  ADD COLUMN IF NOT EXISTS "calendarDueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduleType" "DeliverableScheduleType" NOT NULL DEFAULT 'CMonth';

ALTER TABLE "DeliverableTemplate"
  ALTER COLUMN "offsetMonths" DROP NOT NULL;

ALTER TABLE "Deliverable"
  ADD COLUMN IF NOT EXISTS "scheduleType" "DeliverableScheduleType" NOT NULL DEFAULT 'CMonth';

ALTER TABLE "Deliverable"
  ALTER COLUMN "cMonthOffset" DROP NOT NULL,
  ALTER COLUMN "cMonthLabel" DROP NOT NULL;

UPDATE "DeliverableTemplate"
SET "scheduleType" = 'CMonth'
WHERE "scheduleType" IS NULL;

UPDATE "Deliverable"
SET "scheduleType" = 'CMonth'
WHERE "scheduleType" IS NULL;
