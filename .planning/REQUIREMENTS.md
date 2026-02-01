# Requirements: Descriptor Library v1.0

**Project:** WorldSkills Competition Management System
**Milestone:** v1.0 Descriptor Library
**Defined:** 2026-02-01
**Core Value:** Enable SCMs to write better marking schemes by providing searchable access to proven descriptors from WSC2024

## v1 Requirements

### Data Import & Analysis

- [ ] **IMPORT-01**: Parse all 58 WSC2024 Excel marking schemes from source directory
- [ ] **IMPORT-02**: Handle Excel file variance (merged cells, varying terminology, inconsistent column structures)
- [ ] **IMPORT-03**: Extract descriptor text with complete performance levels (Excellent, Good, Pass, Below Pass)
- [ ] **IMPORT-04**: Normalize extracted text content (convert smart quotes, bullets, handle Unicode artifacts)
- [ ] **IMPORT-05**: Capture source skill metadata for each descriptor (skill name, sector, WSC2024 attribution)
- [ ] **IMPORT-06**: Validate data quality during import (detect encoding issues, flag extraction artifacts, log failures)
- [ ] **IMPORT-07**: Bulk import with transaction safety (all-or-nothing, rollback on failure)
- [ ] **IMPORT-08**: Manual curation interface for admins to review, edit, and approve imported descriptors

### Descriptor Management (Admin CRUD)

- [ ] **MANAGE-01**: Admin can manually add new descriptor (not just from import - for creating custom descriptors)
- [ ] **MANAGE-02**: Admin can edit existing descriptor (text content, performance levels, tags, quality indicator, source attribution)
- [ ] **MANAGE-03**: Admin can delete descriptor from library (with confirmation prompt)
- [ ] **MANAGE-04**: Soft delete support (mark as deleted, preserve for audit trail, option to restore)
- [ ] **MANAGE-05**: Descriptor edit form with all fields (criterion name, performance levels, skill area, criterion type, tags, quality indicator)
- [ ] **MANAGE-06**: Validation for required fields (criterion name, at least one performance level, source skill)
- [ ] **MANAGE-07**: Duplicate detection when creating descriptors (warn if similar descriptor exists)

### Descriptor Library Structure

- [ ] **LIBRARY-01**: Store descriptors with performance level grouping (complete criteria, not isolated levels)
- [ ] **LIBRARY-02**: Support tag-based categorization with flexible multi-dimensional tags (e.g., "teamwork", "safety", "precision")
- [ ] **LIBRARY-03**: Store quality indicators to mark descriptors as "excellent example" vs "reference only"
- [ ] **LIBRARY-04**: Schema versioning for descriptors (version field, backward-compatible migrations, rollback support)
- [ ] **LIBRARY-05**: Database indexes for performance (GIN indexes for full-text search and JSONB tag arrays)
- [ ] **LIBRARY-06**: Data-driven category/tag taxonomy (emerge from imported corpus, minimum 5+ descriptors per category)

### Search & Discovery

- [ ] **SEARCH-01**: Full-text keyword search across descriptor text with relevance ranking (PostgreSQL FTS with ts_rank)
- [ ] **SEARCH-02**: Multi-criteria filtering (skill area, criterion type, performance level) with faceted filter pattern
- [ ] **SEARCH-03**: Combine search and filters seamlessly (filters narrow search results, not replace)
- [ ] **SEARCH-04**: Pagination for search results (default 20 per page, configurable)
- [ ] **SEARCH-05**: Search performance optimization (<100ms target with GIN indexes, query plan analysis)
- [ ] **SEARCH-06**: Save frequently used search queries (saved searches with URL persistence)
- [ ] **SEARCH-07**: Favorite/bookmark descriptors for quick access (personal workspace per SCM)
- [ ] **SEARCH-08**: Related descriptor suggestions (recommendation engine showing similar descriptors)

### Library UI

- [ ] **UI-01**: Search interface with debounced input (300ms delay to reduce server load)
- [ ] **UI-02**: Faceted filter panels with counts (e.g., "Safety (23)", "Teamwork (15)")
- [ ] **UI-03**: Preview modal showing complete criterion with all performance levels grouped together
- [ ] **UI-04**: Copy to clipboard with single-click and visual confirmation (toast: "Copied to clipboard")
- [ ] **UI-05**: Source attribution display (badge showing origin WSC2024 skill for trust signal)
- [ ] **UI-06**: Performance level grouping in display (show Excellent/Good/Pass/Below Pass as complete criterion, not isolated)
- [ ] **UI-07**: Clear visual hierarchy (typography/spacing to separate descriptor content from metadata/tags)
- [ ] **UI-08**: Responsive design (mobile-friendly search/browse, no horizontal scroll, readable on tablets)
- [ ] **UI-09**: Comparison view (side-by-side display of 2-3 selected descriptors to aid decision-making)
- [ ] **UI-10**: Multi-select UI pattern for batch operations (select multiple descriptors for comparison)

### Access Control

- [ ] **ACCESS-01**: SCMs can search and view descriptor library (read access to all descriptors)
- [ ] **ACCESS-02**: Admins can curate library (add, edit, delete descriptors, assign tags/quality indicators)
- [ ] **ACCESS-03**: Skill Advisors can search and view descriptor library (read access)
- [ ] **ACCESS-04**: Extend existing permission patterns from skills management (canAccessDescriptorLibrary follows canManageSkill)

## v2 Requirements (Deferred)

Features explicitly deferred to future versions after v1.0 is validated:

- [ ] **FUTURE-01**: Cross-skill pattern discovery — "See how other skills describe teamwork/safety/precision" (requires mature taxonomy, value unclear without usage data)
- [ ] **FUTURE-02**: Advanced recommendation engine — ML-powered suggestions based on descriptor similarity scoring (requires data science investment)
- [ ] **FUTURE-03**: Collaborative contribution workflow — SCMs suggest descriptors → Admin reviews → Approve/Reject (requires submission + moderation system)
- [ ] **FUTURE-04**: Bulk import UI for admins — CSV upload interface for adding descriptors (manual entry sufficient for v1.0)
- [ ] **FUTURE-05**: Descriptor usage analytics dashboard — "Most used descriptors", "trending in similar skills" (needs 3+ months of usage data)
- [ ] **FUTURE-06**: API access for external integrations — REST API for third-party marking scheme tools (not requested, evaluate demand)

## Out of Scope

Features explicitly excluded from v1.0 milestone:

| Feature | Reason |
|---------|--------|
| In-app marking scheme builder | Marking schemes managed in external systems, users copy/paste descriptors into those tools |
| Export functionality (Excel/PDF/Word) | Not needed since marking schemes are external |
| AI-generated descriptors | Quality control nightmare, marking schemes need precision, AI hallucinates measurements/criteria |
| Collaborative editing of descriptor library | Quality dilution risk, becomes dumping ground without admin curation |
| Real-time updates via WebSocket | Complexity without value for stable reference data (library is not collaborative document) |
| Multi-language support | English only for v1.0, defer translation until library proven valuable |
| Auto-validation of inserted descriptors | False confidence, automation can't judge if descriptor fits skill context |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMPORT-01 | Phase 1 | Pending |
| IMPORT-02 | Phase 1 | Pending |
| IMPORT-03 | Phase 1 | Pending |
| IMPORT-04 | Phase 1 | Pending |
| IMPORT-05 | Phase 1 | Pending |
| IMPORT-06 | Phase 1 | Pending |
| IMPORT-07 | Phase 1 | Pending |
| IMPORT-08 | Phase 2 | Pending |
| MANAGE-01 | Phase 2 | Pending |
| MANAGE-02 | Phase 2 | Pending |
| MANAGE-03 | Phase 2 | Pending |
| MANAGE-04 | Phase 2 | Pending |
| MANAGE-05 | Phase 2 | Pending |
| MANAGE-06 | Phase 2 | Pending |
| MANAGE-07 | Phase 2 | Pending |
| LIBRARY-01 | Phase 1 | Pending |
| LIBRARY-02 | Phase 2 | Pending |
| LIBRARY-03 | Phase 2 | Pending |
| LIBRARY-04 | Phase 1 | Pending |
| LIBRARY-05 | Phase 1 | Pending |
| LIBRARY-06 | Phase 2 | Pending |
| SEARCH-01 | Phase 3 | Pending |
| SEARCH-02 | Phase 3 | Pending |
| SEARCH-03 | Phase 3 | Pending |
| SEARCH-04 | Phase 3 | Pending |
| SEARCH-05 | Phase 3 | Pending |
| SEARCH-06 | Phase 3 | Pending |
| SEARCH-07 | Phase 3 | Pending |
| SEARCH-08 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| UI-06 | Phase 4 | Pending |
| UI-07 | Phase 4 | Pending |
| UI-08 | Phase 4 | Pending |
| UI-09 | Phase 4 | Pending |
| UI-10 | Phase 4 | Pending |
| ACCESS-01 | Phase 5 | Pending |
| ACCESS-02 | Phase 5 | Pending |
| ACCESS-03 | Phase 5 | Pending |
| ACCESS-04 | Phase 5 | Pending |

**Coverage Summary:**
- v1 requirements: 39 total across 6 categories
- Phase mapping: 39/39 requirements mapped (100% coverage)
- v2 requirements: 6 deferred features
- Out of scope: 7 explicit exclusions

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 (traceability added)*
