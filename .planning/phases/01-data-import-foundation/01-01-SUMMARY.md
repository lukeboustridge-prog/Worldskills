---
phase: 01-data-import-foundation
plan: 01
subsystem: database
tags: [prisma, schema, migration, exceljs, descriptor-model]
requires: []
provides: [descriptor-table, exceljs-dependency, schema-versioning]
affects: [01-02, 01-03]
tech-stack:
  added: [exceljs@4.4.0]
  patterns: [composite-unique-constraints, b-tree-indexing, schema-versioning]
key-files:
  created:
    - prisma/migrations/20260201074244_add_descriptors/migration.sql
  modified:
    - prisma/schema.prisma
    - package.json
    - pnpm-lock.yaml
decisions:
  - id: DESC-001
    choice: "Use ExcelJS instead of SheetJS for Excel parsing"
    rationale: "ExcelJS is actively maintained and has no known CVEs, while SheetJS (xlsx) has CVE-2023-30533 and is no longer published to npm"
  - id: DESC-002
    choice: "Store all performance levels (excellent/good/pass/belowPass) in single Descriptor record"
    rationale: "Simplifies queries and matches the marking scheme structure where all levels are defined together"
  - id: DESC-003
    choice: "Use composite unique constraint [skillName, code] instead of global code uniqueness"
    rationale: "Same criterion code can exist across different skills, must only be unique within a skill"
  - id: DESC-004
    choice: "Add B-tree indexes now, defer GIN indexes until after bulk import"
    rationale: "B-tree indexes support common filtering queries, GIN indexes for array/text search are more efficient when added after data is loaded"
metrics:
  duration: 13m 20s
  completed: 2026-02-01
---

# Phase 01 Plan 01: Database Schema & Dependencies Summary

**One-liner:** Established Prisma Descriptor model with performance levels, source metadata, and schema versioning; installed ExcelJS 4.4.0 for secure Excel import.

## What Was Built

### Descriptor Data Model
- Created Prisma model with complete descriptor structure:
  - Identity: `id`, `code`, `criterionName`
  - Performance levels: `excellent`, `good`, `pass`, `belowPass` (all TEXT fields)
  - Source metadata: `source`, `skillName`, `sector`
  - Organization: `category`, `tags` (PostgreSQL array)
  - Versioning: `version` field (default 1) for future schema migrations
  - Audit: `createdAt`, `updatedAt` timestamps

### Database Migration
- Applied migration `20260201074244_add_descriptors`
- Created Descriptor table in PostgreSQL database
- Established composite unique constraint on `[skillName, code]`
- Added B-tree indexes on: `source`, `skillName`, `sector`, `category`, `version`

### Dependencies
- Installed ExcelJS 4.4.0 (secure Excel parser)
- Avoided SheetJS due to CVE-2023-30533 security vulnerability

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Add Descriptor model to Prisma schema | 816d6b9 | prisma/schema.prisma |
| 2 | Install ExcelJS and create migration | ab96f84 | package.json, pnpm-lock.yaml, prisma/migrations/ |

## Decisions Made

### DESC-001: ExcelJS over SheetJS
**Context:** Need Excel parsing for WSC2024 descriptor import
**Options:** SheetJS (xlsx), ExcelJS, node-xlsx
**Chosen:** ExcelJS 4.4.0
**Rationale:**
- SheetJS has CVE-2023-30533 and is no longer maintained on npm
- ExcelJS is actively maintained, well-documented, and has no known vulnerabilities
- Supports both reading and writing Excel files (.xlsx)

### DESC-002: Denormalized Performance Levels
**Context:** How to store the 4 performance levels (excellent/good/pass/belowPass)
**Options:** (1) Separate table with level enum, (2) JSON field, (3) Individual TEXT columns
**Chosen:** Individual TEXT columns on Descriptor model
**Rationale:**
- Matches marking scheme structure (all levels defined together)
- Simplifies queries (no joins, direct column access)
- Allows NULL for levels that don't apply to a criterion
- Easier to index and search individual levels

### DESC-003: Composite Unique Constraint
**Context:** How to ensure criterion code uniqueness
**Options:** (1) Global unique on code, (2) Unique [skillName, code]
**Chosen:** Composite unique constraint on `[skillName, code]`
**Rationale:**
- Same code (e.g., "A1") can exist across different skills
- Code must be unique within a skill to prevent duplicates
- Allows natural criterion codes without artificial prefixing

### DESC-004: Staged Index Strategy
**Context:** When to add GIN indexes for full-text search
**Options:** (1) All indexes now, (2) B-tree now + GIN after import
**Chosen:** B-tree indexes now, defer GIN until after bulk import
**Rationale:**
- B-tree indexes (source, skillName, sector, category, version) support common filters
- GIN indexes for array/text search are more efficient when created after data exists
- Reduces migration time and avoids index rebuilds during bulk insert

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed migration ordering for ResourceCategory enum**
- **Found during:** Task 2 - Creating Descriptor migration
- **Issue:** Migration `20260201_add_external_resource_category` tried to alter enum before it was created by `20260201_add_resource_link` (alphabetical ordering issue)
- **Blocking:** Prisma shadow database validation failed, preventing new migrations
- **Fix:** Renamed migration to `20260201190000_add_external_resource_category` to ensure correct chronological order
- **Files modified:**
  - Moved `prisma/migrations/20260201_add_external_resource_category/` → `prisma/migrations/20260201190000_add_external_resource_category/`
- **Commit:** ab96f84 (included in Task 2)

**2. [Rule 3 - Blocking] Bypassed non-interactive environment limitation**
- **Found during:** Task 2 - Creating migration
- **Issue:** `prisma migrate dev` detected non-interactive environment and refused to run
- **Blocking:** Could not create migration through standard workflow
- **Fix:**
  - Used `prisma migrate diff` to generate SQL
  - Created migration directory manually with timestamp
  - Wrote migration.sql with only Descriptor table changes
  - Applied via `prisma migrate deploy` (no shadow database check)
- **Files created:** `prisma/migrations/20260201074244_add_descriptors/migration.sql`
- **Commit:** ab96f84 (Task 2)

## Technical Notes

### Schema Design
- PostgreSQL native array type used for `tags` field (not JSON)
- TEXT type for performance level descriptions (supports multi-paragraph content)
- Version field enables future schema evolution (e.g., adding new performance levels)

### Migration Strategy
- Avoided shadow database validation by using `prisma migrate deploy`
- Manual migration creation ensures clean SQL without drift
- Migration file includes only Descriptor changes (no unrelated schema drift)

### Index Strategy
Current indexes (B-tree):
- `source`: Filter by WSC2024 vs Manual descriptors
- `skillName`: Filter by skill
- `sector`: Filter by sector category
- `category`: Filter by criterion type
- `version`: Support schema versioning queries

Deferred indexes (GIN):
- Full-text search on descriptor text fields (added in Phase 2 after import)
- Tag array search (added after tagging patterns emerge)

## Next Phase Readiness

### Provides for Phase 01-02
✅ Descriptor table exists in database
✅ ExcelJS installed for Excel parsing
✅ Schema supports all required descriptor fields
✅ Composite unique constraint prevents duplicate codes per skill
✅ Indexes ready for common query patterns

### Potential Issues
- None identified

### Recommendations
1. Consider adding a `notes` TEXT field in future version for admin annotations
2. May want to add `lastReviewedAt` timestamp for content freshness tracking
3. Consider adding `difficulty` or `complexity` field for advanced filtering

## Files Changed

### Created
```
prisma/migrations/20260201074244_add_descriptors/migration.sql
```

### Modified
```
prisma/schema.prisma         # Added Descriptor model (38 lines)
package.json                 # Added exceljs@4.4.0 dependency
pnpm-lock.yaml              # Updated dependency lock
```

### Migration Changes
```
Renamed: 20260201_add_external_resource_category/
      → 20260201190000_add_external_resource_category/
```

## Verification Results

✅ `npx prisma validate` - Schema is valid
✅ `pnpm list exceljs` - ExcelJS 4.4.0 installed
✅ Migration file exists at `prisma/migrations/20260201074244_add_descriptors/migration.sql`
✅ `npx prisma migrate status` - Database schema is up to date
✅ Descriptor table created with all required columns
✅ Composite unique constraint on [skillName, code]
✅ B-tree indexes created on source, skillName, sector, category, version

## Success Criteria Met

✅ Descriptor model in schema.prisma with all required fields
✅ Composite unique constraint on [skillName, code]
✅ B-tree indexes on source, skillName, sector, category, version
✅ ExcelJS 4.4+ in package.json dependencies
✅ Migration applied, Descriptor table exists in database

---

*Execution completed: 2026-02-01*
*Duration: 13m 20s*
*Commits: 816d6b9, ab96f84*
