-- GIN indexes for full-text search on Descriptor table
-- Created AFTER bulk import to avoid 10-100x slowdown during insert

-- Primary FTS index: search across criterion name
-- Most common search use case
CREATE INDEX IF NOT EXISTS descriptor_criterion_fts_idx ON "Descriptor"
USING gin(
  to_tsvector('english', coalesce("criterionName", ''))
);

-- Combined FTS index: search across all text content
-- For broader searches
CREATE INDEX IF NOT EXISTS descriptor_all_fts_idx ON "Descriptor"
USING gin(
  to_tsvector('english',
    coalesce("criterionName", '') || ' ' ||
    coalesce("excellent", '') || ' ' ||
    coalesce("good", '') || ' ' ||
    coalesce("pass", '') || ' ' ||
    coalesce("belowPass", '')
  )
);

-- GIN index on tags array for tag-based filtering
-- Enables @> (contains) queries on tags
CREATE INDEX IF NOT EXISTS descriptor_tags_idx ON "Descriptor"
USING gin("tags");
