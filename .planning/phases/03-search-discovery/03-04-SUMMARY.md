---
phase: 03-search-discovery
plan: 04
subsystem: search
tags: [pg_trgm, similarity, cross-skill-discovery, postgresql, recommendations]

# Dependency graph
requires:
  - phase: 02-admin-curation
    provides: "pg_trgm extension and baseline indexes"
provides:
  - "getRelatedDescriptors query function for similarity-based recommendations"
  - "getRelatedByCriterionName for create/edit workflows"
  - "Cross-skill discovery capability (SEARCH-08)"
  - "idx_descriptors_trgm GIN index for efficient similarity queries"
affects: [descriptor-detail-ui, descriptor-create-ui, descriptor-edit-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CROSS JOIN LATERAL for efficient top-N similarity queries", "Configurable similarity threshold pattern"]

key-files:
  created:
    - src/lib/queries/related-descriptors.ts
    - scripts/test-related-descriptors.ts
    - scripts/test-cross-skill-discovery.ts
    - scripts/check-trgm-index.ts
    - scripts/create-trgm-index.ts
  modified: []

key-decisions:
  - "Use CROSS JOIN LATERAL instead of WHERE IN subquery for better performance on top-N per row pattern"
  - "Default similarity threshold 0.3 matches pg_trgm default, tunable based on user feedback"
  - "Two functions: by-ID for detail view, by-text for create/edit forms"

patterns-established:
  - "Similarity recommendation pattern with pg_trgm for cross-entity discovery"
  - "Minimum text length guard (5 chars) before running similarity queries"

# Metrics
duration: 14min
completed: 2026-02-01
---

# Phase 3 Plan 4: Related Descriptors Recommendation Engine Summary

**pg_trgm similarity engine for cross-skill descriptor discovery with CROSS JOIN LATERAL top-N optimization**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-01T13:54:19Z
- **Completed:** 2026-02-01T14:08:10Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Related descriptor recommendation using PostgreSQL pg_trgm similarity function
- Cross-skill discovery validated - finds similar criteria from other skills (e.g., "Safety" from Information Network Cabling finds matches in Cabinetmaking, Refrigeration)
- CROSS JOIN LATERAL pattern for efficient top-N similarity queries
- Configurable similarity threshold (default 0.3, tested with 0.25)
- Missing pg_trgm GIN index identified and created

## Task Commits

Each task was committed atomically:

1. **Task 1: Create related descriptors query function** - `f06d64b` (feat)
2. **Task 2: Verify GIN index for similarity queries** - `47550ef` (fix)
3. **Task 3: Test cross-skill discovery use case** - `72afdb3` (test)

## Files Created/Modified
- `src/lib/queries/related-descriptors.ts` - getRelatedDescriptors and getRelatedByCriterionName query functions
- `scripts/test-related-descriptors.ts` - Test both by-ID and by-text matching functions
- `scripts/test-cross-skill-discovery.ts` - Validate cross-skill discovery (SEARCH-08)
- `scripts/check-trgm-index.ts` - EXPLAIN ANALYZE to verify index usage and performance
- `scripts/create-trgm-index.ts` - Script to create missing trigram index
- `scripts/find-trgm-index.ts` - Diagnostic script to search for trigram indexes
- `scripts/list-descriptor-indexes.ts` - List all indexes on Descriptor table

## Decisions Made

**1. CROSS JOIN LATERAL for top-N similarity**
- Rationale: More efficient than WHERE IN subquery for "top 5 similar per row" pattern. LATERAL allows subquery to reference outer table row.
- Impact: Better query plan, clearer intent, standard PostgreSQL pattern for per-row top-N.

**2. Default similarity threshold 0.3**
- Rationale: Matches pg_trgm default threshold. Can be tuned lower (more results) or higher (stricter matching) based on user feedback.
- Impact: Starting point balances precision and recall.

**3. Two function variants**
- Rationale: getRelatedDescriptors(id) for detail view when descriptor exists, getRelatedByCriterionName(text) for create/edit forms before descriptor is saved.
- Impact: UI flexibility - can show related items during creation before record exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing pg_trgm GIN index on criterionName**
- **Found during:** Task 2 (Index verification)
- **Issue:** The idx_descriptors_trgm GIN index was defined in Phase 2 migration (20260202001957_add_descriptor_curation) but was not present in the database. pg_trgm extension was installed but index was missing.
- **Fix:** Created index manually using `CREATE INDEX idx_descriptors_trgm ON "Descriptor" USING GIN ("criterionName" gin_trgm_ops)`
- **Files modified:** Database index, added creation script at scripts/create-trgm-index.ts
- **Verification:** Index exists and queries perform acceptably (<2ms). PostgreSQL uses sequential scan for small table (<1K rows), which is expected and acceptable.
- **Commit:** 47550ef

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Index was required for task completion. Without it, similarity queries wouldn't have index support (though performance is acceptable anyway for current table size).

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Related descriptor recommendation engine ready for UI integration
- Cross-skill discovery validated and working
- Pattern supports both detail view (by ID) and create/edit workflows (by text)
- Performance acceptable (<2ms) for current corpus size (~600 descriptors)
- If corpus grows >10K descriptors and performance degrades, consider adjusting similarity threshold or query optimization

Ready for 03-05: Additional search features

---
*Phase: 03-search-discovery*
*Completed: 2026-02-01*
