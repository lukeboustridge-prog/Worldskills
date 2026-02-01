-- Rename descriptor level columns from excellent/good/pass/belowPass to score3/score2/score1/score0
-- This preserves all existing data

ALTER TABLE "Descriptor" RENAME COLUMN "excellent" TO "score3";
ALTER TABLE "Descriptor" RENAME COLUMN "good" TO "score2";
ALTER TABLE "Descriptor" RENAME COLUMN "pass" TO "score1";
ALTER TABLE "Descriptor" RENAME COLUMN "belowPass" TO "score0";

-- Add comments for clarity
COMMENT ON COLUMN "Descriptor"."score0" IS 'Below standard - 0 points';
COMMENT ON COLUMN "Descriptor"."score1" IS 'Acceptable - 1 point';
COMMENT ON COLUMN "Descriptor"."score2" IS 'Good - 2 points';
COMMENT ON COLUMN "Descriptor"."score3" IS 'Excellent - 3 points';
