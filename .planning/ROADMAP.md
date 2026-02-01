# Roadmap: Descriptor Library v1.0

## Overview

This roadmap delivers a searchable descriptor library for SCMs to access proven marking scheme descriptors from WSC2024. The journey starts with robust Excel parsing and data import (highest risk), establishes admin curation workflows, implements search with relevance tuning, builds the library UI with preview and copy functionality, and completes with access control integration. The focus is exclusively on library features—marking scheme builder and export functionality are out of scope as users copy descriptors into external tools.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Import & Foundation** - Parse WSC2024 Excel files and establish database schema
- [ ] **Phase 2: Admin Curation** - Enable admin CRUD for descriptor library management
- [ ] **Phase 3: Search & Discovery** - Implement full-text search with relevance tuning
- [ ] **Phase 4: Library UI** - Build search interface with preview and clipboard integration
- [ ] **Phase 5: Access Control & Polish** - Integrate permissions and finalize library

## Phase Details

### Phase 1: Data Import & Foundation
**Goal**: Import all 58 WSC2024 marking schemes with robust parsing and establish database schema with performance indexes
**Depends on**: Nothing (first phase)
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, LIBRARY-01, LIBRARY-04, LIBRARY-05
**Success Criteria** (what must be TRUE):
  1. All 58 WSC2024 Excel files successfully parsed without silent failures
  2. Descriptors stored with complete performance levels (Excellent/Good/Pass/Below Pass grouped together)
  3. Text content normalized (smart quotes, bullets, Unicode artifacts converted to clean text)
  4. Source skill metadata captured for every descriptor (skill name, sector, WSC2024 attribution visible)
  5. Database schema includes version field and rollback capability for future migrations
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md - Database schema and ExcelJS installation
- [ ] 01-02-PLAN.md - Survey all 58 Excel files for structure variance
- [ ] 01-03-PLAN.md - Excel parser with text normalization and validation
- [ ] 01-04-PLAN.md - Bulk import with batched transactions
- [ ] 01-05-PLAN.md - GIN indexes for full-text search and verification

### Phase 2: Admin Curation
**Goal**: Enable admins to manually create, edit, delete, and quality-control descriptors in the library
**Depends on**: Phase 1 (requires database schema and imported data)
**Requirements**: MANAGE-01, MANAGE-02, MANAGE-03, MANAGE-04, MANAGE-05, MANAGE-06, MANAGE-07, IMPORT-08, LIBRARY-02, LIBRARY-03, LIBRARY-06
**Success Criteria** (what must be TRUE):
  1. Admin can add new custom descriptors (not just imported ones) with full metadata
  2. Admin can edit descriptor text, performance levels, tags, and quality indicators
  3. Admin can delete descriptors with soft-delete preservation for audit trail
  4. Validation prevents saving descriptors without required fields (criterion name, performance level, source)
  5. Duplicate detection warns admin if similar descriptor already exists
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md - Database schema extensions (QualityIndicator enum, soft delete, pg_trgm)
- [ ] 02-02-PLAN.md - Server Actions and query functions (CRUD, duplicate detection)
- [ ] 02-03-PLAN.md - Admin UI (list, create, edit pages, delete confirmation)

### Phase 3: Search & Discovery
**Goal**: Implement PostgreSQL full-text search with relevance ranking and multi-criteria filtering
**Depends on**: Phase 1 (requires imported descriptor corpus), Phase 2 (requires tag taxonomy)
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07, SEARCH-08
**Success Criteria** (what must be TRUE):
  1. Keyword search returns results ranked by relevance (most relevant descriptors appear first)
  2. Filters (skill area, criterion type, performance level) narrow search results seamlessly
  3. Search completes in under 100ms for typical queries (tested with 12K+ descriptor corpus)
  4. Users can save frequently used search queries via URL persistence
  5. Search relevance validated with 10 real SCM test queries (top 3 results are relevant)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Library UI
**Goal**: Build search interface with faceted filtering, preview modals, and clipboard integration
**Depends on**: Phase 3 (requires working search backend)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. SCM can search descriptors with debounced input (300ms delay, no excessive server load)
  2. Faceted filter panels show counts (e.g., "Safety (23)", "Teamwork (15)") and update dynamically
  3. Preview modal displays complete criterion with all performance levels grouped together
  4. Single-click copy to clipboard works with visual confirmation toast ("Copied to clipboard")
  5. Source attribution badge shows origin WSC2024 skill for trust signal
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Access Control & Polish
**Goal**: Integrate descriptor library permissions with existing role system and finalize user experience
**Depends on**: Phase 4 (requires complete library UI)
**Requirements**: ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04
**Success Criteria** (what must be TRUE):
  1. SCMs can search and view descriptor library (read access to all descriptors)
  2. Skill Advisors can search and view descriptor library (read access)
  3. Admins can access curation interface (add, edit, delete descriptors)
  4. Permission checks follow existing patterns (canAccessDescriptorLibrary follows canManageSkill)
  5. Library integrated into existing navigation (accessible from hub or skill workspace)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Import & Foundation | 0/5 | Ready | - |
| 2. Admin Curation | 0/3 | Ready | - |
| 3. Search & Discovery | 0/TBD | Not started | - |
| 4. Library UI | 0/TBD | Not started | - |
| 5. Access Control & Polish | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-01*
*Last updated: 2026-02-02 after Phase 2 planning*
