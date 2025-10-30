ALTER TABLE "Deliverable" ADD COLUMN "templateKey" TEXT;
ALTER TABLE "Deliverable" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Deliverable" SET "templateKey" = "key";

ALTER TABLE "Deliverable" DROP CONSTRAINT IF EXISTS "Deliverable_key_fkey";

ALTER TABLE "Deliverable"
  ADD CONSTRAINT "Deliverable_templateKey_fkey"
  FOREIGN KEY ("templateKey") REFERENCES "DeliverableTemplate"("key")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
