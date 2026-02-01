-- Functional GIN index for weighted full-text search
-- A-weight (1.0) for criterionName = most important
-- B-weight (0.4) for performance levels = secondary importance
CREATE INDEX idx_descriptors_fts
ON "Descriptor"
USING GIN ((
  setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
));

-- Partial B-tree indexes for filter columns (only non-deleted rows)
CREATE INDEX idx_descriptors_skill_name_active ON "Descriptor"("skillName") WHERE "deletedAt" IS NULL;
CREATE INDEX idx_descriptors_category_active ON "Descriptor"("category") WHERE "deletedAt" IS NULL;
CREATE INDEX idx_descriptors_quality_active ON "Descriptor"("qualityIndicator") WHERE "deletedAt" IS NULL;
