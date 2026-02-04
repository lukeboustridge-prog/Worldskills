# Roadmap: Descriptor Library v1.0

## Overview

This roadmap delivers a searchable descriptor library for SCMs to access proven marking scheme descriptors from WSC2024. The journey starts with robust Excel parsing and data import (highest risk), establishes admin curation workflows, implements search with relevance tuning, builds the library UI with preview and copy functionality, and completes with access control integration. The focus is exclusively on library features—marking scheme builder and export functionality are out of scope as users copy descriptors into external tools.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Import & Foundation** - Parse WSC2024 Excel files and establish database schema
- [x] **Phase 2: Admin Curation** - Enable admin CRUD for descriptor library management
- [x] **Phase 3: Search & Discovery** - Implement full-text search with relevance tuning
- [x] **Phase 4: Library UI** - Build search interface with preview and clipboard integration
- [x] **Phase 5: Access Control & Polish** - Integrate permissions and finalize library

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
- [x] 01-01-PLAN.md - Database schema and ExcelJS installation
- [x] 01-02-PLAN.md - Survey all 58 Excel files for structure variance
- [x] 01-03-PLAN.md - Excel parser with text normalization and validation
- [x] 01-04-PLAN.md - Bulk import with batched transactions
- [x] 01-05-PLAN.md - GIN indexes for full-text search and verification

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
- [x] 02-01-PLAN.md - Database schema extensions (QualityIndicator enum, soft delete, pg_trgm)
- [x] 02-02-PLAN.md - Server Actions and query functions (CRUD, duplicate detection)
- [x] 02-03-PLAN.md - Admin UI (list, create, edit pages, delete confirmation)

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
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md - Functional GIN index migration and base search function with relevance ranking
- [x] 03-02-PLAN.md - DescriptorFavorite schema and toggle/query functions for bookmarks
- [x] 03-03-PLAN.md - Enhanced search with pagination and faceted filter counts
- [x] 03-04-PLAN.md - Related descriptors recommendations using pg_trgm similarity
- [x] 03-05-PLAN.md - URL-based search state persistence with nuqs and search UI components

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
- [x] 04-01-PLAN.md - Preview modal with toast notifications and source attribution
- [x] 04-02-PLAN.md - Comparison view with multi-select
- [x] 04-03-PLAN.md - Responsive design polish

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
- [x] 05-01-PLAN.md - Move library to authenticated routes and add navigation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Import & Foundation | 5/5 | Complete | 2026-02-01 |
| 2. Admin Curation | 3/3 | Complete | 2026-02-02 |
| 3. Search & Discovery | 5/5 | Complete | 2026-02-02 |
| 4. Library UI | 3/3 | Complete | 2026-02-02 |
| 5. Access Control & Polish | 1/1 | Complete | 2026-02-02 |

---
*Roadmap created: 2026-02-01*
*Last updated: 2026-02-02 after Phase 3 planning*

---

# Roadmap: SCM Descriptor Creation & Approval v2.0

## Overview

This roadmap enables SCMs to contribute new descriptors to the library with SA approval workflow. SCMs create descriptors linked to WSOS sections (with duplicate detection), batch multiple descriptors before submitting for review, and SAs approve or return descriptors with modification tracking. Email notifications keep both roles informed throughout the approval lifecycle. The focus is on collaborative descriptor creation with clear approval boundaries—version history and AI generation are out of scope.

## Phases

- [x] **Phase 6: WSOS Section Management** - Create WSOS section entity with duplicate detection and SCM browsing
- [x] **Phase 7: SCM Descriptor Creation & Batch Workflow** - Enable SCMs to create descriptors and batch submissions
- [x] **Phase 8: SA Approval Workflow** - Build SA review interface with approve/edit/return actions
- [ ] **Phase 9: Email Notifications** - Implement notification emails for submission and approval events

## Phase Details

### Phase 6: WSOS Section Management
**Goal**: Enable SCMs to browse and create WSOS sections with duplicate detection to organize descriptors
**Depends on**: Phase 5 (requires existing descriptor schema and auth system)
**Requirements**: WSOS-01, WSOS-02, WSOS-03, WSOS-04
**Success Criteria** (what must be TRUE):
  1. SCM can view list of all existing WSOS sections with section names
  2. SCM can create new WSOS section by entering a name
  3. System warns SCM when creating section similar to existing ones (duplicate detection using trigram similarity)
  4. New WSOS sections are immediately available in descriptor creation form (no approval delay)
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md - Database schema, migration with GIN trigram index, query utilities
- [x] 06-02-PLAN.md - Server Actions, duplicate warning component, management page UI

### Phase 7: SCM Descriptor Creation & Batch Workflow
**Goal**: Enable SCMs to create descriptors linked to WSOS sections and batch multiple descriptors before submitting for SA review
**Depends on**: Phase 6 (requires WSOS sections to link descriptors)
**Requirements**: DESC-01, DESC-02, DESC-03, DESC-04, BATCH-01, BATCH-02, BATCH-03
**Success Criteria** (what must be TRUE):
  1. SCM can create new descriptor with same fields admins use (criterion name, performance levels, tags)
  2. Every new descriptor must link to exactly one WSOS section (validation prevents orphaned descriptors)
  3. SCM can select existing WSOS section from dropdown or create new section inline during descriptor creation
  4. New SCM-created descriptors automatically have NEEDS_REVIEW status (distinguishable from approved descriptors)
  5. SCM can add multiple descriptors to draft batch before submitting (no premature notifications to SA)
  6. Draft batch page shows pending descriptors with edit/delete actions before submission
  7. SCM clicks "Submit for Review" button to send entire batch to their skill's SA
**Plans**: 4 plans

Plans:
- [x] 07-01-PLAN.md - Database schema extension (DescriptorBatchStatus enum, batch workflow fields)
- [x] 07-02-PLAN.md - SCM descriptor query utilities (getSCMDescriptors, getDraftDescriptors)
- [x] 07-03-PLAN.md - SCM descriptor Server Actions (CRUD + submitBatchAction)
- [x] 07-04-PLAN.md - SCM descriptor UI (My Descriptors page, create/edit forms, WSOS section selector)

### Phase 8: SA Approval Workflow
**Goal**: Enable SAs to review, approve, edit, or return SCM-submitted descriptors with modification tracking
**Depends on**: Phase 7 (requires SCM-created descriptors in NEEDS_REVIEW status)
**Requirements**: APPR-01, APPR-02, APPR-03, APPR-04, APPR-05, APPR-06
**Success Criteria** (what must be TRUE):
  1. SA sees list of pending descriptors from their skill's SCM (filtered by skill relationship)
  2. SA can approve descriptor without changes (status changes from NEEDS_REVIEW to GOOD)
  3. SA can edit descriptor text/performance levels before approving (inline editing or edit form)
  4. System sets wasModifiedDuringApproval flag when SA changes descriptor wording before approving
  5. SA can return descriptor to SCM with rejection comments (descriptor stays NEEDS_REVIEW, visible to SCM)
  6. SCM can see returned descriptors with SA comments, edit them, and resubmit for review
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md - Schema migration (add wasModifiedDuringApproval field)
- [x] 08-02-PLAN.md - SA approval query utilities (getPendingDescriptorsForSA, canSAReviewDescriptor)
- [x] 08-03-PLAN.md - Server Actions (approveDescriptorAction, returnDescriptorAction, updateReturnedDescriptorAction)
- [x] 08-04-PLAN.md - SA pending review UI + SCM returned descriptor editing

### Phase 9: Email Notifications
**Goal**: Send email notifications to SA and SCM at key approval workflow events using existing Resend infrastructure
**Depends on**: Phase 8 (requires approval workflow actions to trigger emails)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05
**Success Criteria** (what must be TRUE):
  1. SA receives email when SCM submits batch for review (includes count and link to review page)
  2. SCM receives email when SA approves descriptors (lists approved descriptors)
  3. Approval email clearly indicates if any descriptors had wording modified by SA
  4. SCM receives email when SA returns descriptors with rejection comments (includes SA comments)
  5. SA receives email when SCM resubmits previously returned descriptors (notification of resubmission)
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. WSOS Section Management | 2/2 | Complete | 2026-02-04 |
| 7. SCM Descriptor Creation & Batch Workflow | 4/4 | Complete | 2026-02-04 |
| 8. SA Approval Workflow | 4/4 | Complete | 2026-02-04 |
| 9. Email Notifications | 0/? | Pending | — |

---
*Roadmap created: 2026-02-04*
*Last updated: 2026-02-04 after Phase 8 completion*
