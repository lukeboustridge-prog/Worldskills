ALTER TABLE "Deliverable" ADD COLUMN "evidenceItems" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "Deliverable"
SET "evidenceItems" = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'url', link,
    'type', 'Document',
    'addedAt', NOW()
  )), '[]'::jsonb)
  FROM UNNEST("evidenceLinks") AS link
);

ALTER TABLE "Deliverable" DROP COLUMN "evidenceLinks";
