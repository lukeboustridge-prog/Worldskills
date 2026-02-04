---
phase: "06-wsos-section-management"
plan: "01"
subsystem: "data-layer"
tags: [prisma, postgresql, pg_trgm, wsos-sections]

dependency_graph:
  requires: ["05-01"]
  provides: ["wsos-section-model", "similarity-search", "query-utilities"]
  affects: ["06-02"]

tech_stack:
  added: []
  patterns:
    - "WSOSSection model with GIN trigram index"
    - "Similarity-based duplicate detection (0.3 threshold)"
    - "Raw SQL queries via Prisma.sql template literals"

key_files:
  created:
    - "prisma/migrations/20260204_wsos_sections/migration.sql"
    - "src/lib/wsos-sections.ts"
  modified:
    - "prisma/schema.prisma"

decisions:
  - id: "WSOS-001"
    decision: "0.3 similarity threshold for section names"
    rationale: "Section names are shorter than descriptor criterion names; lower threshold catches more variations"

metrics:
  duration: "5m 31s"
  completed: "2026-02-04"
---

# Phase 6 Plan 1: WSOS Section Data Layer Summary

WSOSSection model with GIN trigram index for duplicate detection and query utilities.

## What Was Built

### Database Model
- **WSOSSection** model in Prisma schema with:
  - `id` (cuid primary key)
  - `name` (unique constraint for exact duplicate prevention)
  - `description` (optional text field)
  - `createdAt`, `updatedAt` (audit timestamps)
  - `createdBy` (foreign key to User)
  - `creator` relation to User model

### Migration
- Created `20260204_wsos_sections` migration with:
  - Table creation with primary key
  - Unique constraint on `name`
  - B-tree index on `name` for exact lookups
  - GIN trigram index (`wsos_section_name_trgm`) for similarity queries
  - Foreign key constraint to User table

### Query Utilities
- **`getAllWSOSSections()`**: Returns all sections ordered by name with creator info
- **`findSimilarWSOSSections(name, threshold?, excludeId?, limit?)`**: pg_trgm similarity search with 0.3 default threshold
- **`getWSOSSectionById(id)`**: Simple findUnique query
- **`WSOSSectionWithCreator`** type export for consumer use

## Key Technical Details

### Trigram Index
The GIN trigram index enables efficient similarity matching:
```sql
CREATE INDEX wsos_section_name_trgm ON "WSOSSection" USING GIN (name gin_trgm_ops);
```

### Similarity Query Pattern
Follows existing `src/lib/duplicate-detection.ts` pattern:
```typescript
const similar = await prisma.$queryRaw<SimilarSection[]>(Prisma.sql`
  SELECT id, name, similarity(name, ${name}) as similarity
  FROM "WSOSSection"
  WHERE similarity(name, ${name}) > ${threshold}
  ORDER BY similarity DESC LIMIT ${limit}
`);
```

### Threshold Selection
- Descriptors use 0.4 threshold (longer criterion names)
- WSOS sections use 0.3 threshold (shorter section names, need more sensitivity)
- Tested with British vs American spelling: "Work Organisation and Management" matched "Work Organization Management" at 0.722 similarity

## Commits

| Hash | Message |
|------|---------|
| 7e18682 | feat(06-01): add WSOSSection model to Prisma schema |
| 9fd9d34 | feat(06-01): add WSOSSection migration with GIN trigram index |
| 2b33681 | feat(06-01): add WSOS section query utilities |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Status |
|-------|--------|
| `npx prisma validate` passes | PASS |
| WSOSSection table exists | PASS |
| GIN trigram index exists | PASS |
| TypeScript compiles | PASS |
| Similarity query works | PASS (tested with spelling variation) |

## Next Phase Readiness

**Ready for 06-02:** Server Actions, duplicate warning component, and management page UI.

### Available for 06-02:
- `getAllWSOSSections()` for listing sections
- `findSimilarWSOSSections()` for duplicate detection
- `WSOSSectionWithCreator` type for UI
- `WSOSSection` Prisma type for mutations

### Integration Points:
- Server Actions will use `prisma.wSOSSection.create/update/delete`
- Duplicate warning will call `findSimilarWSOSSections()` on input change
- Management page will call `getAllWSOSSections()` for list view
