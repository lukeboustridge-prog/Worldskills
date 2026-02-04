# Requirements: SCM Descriptor Creation & Approval v2.0

**Project:** WorldSkills Competition Management System
**Milestone:** v2.0 SCM Descriptor Creation & Approval Workflow
**Defined:** 2026-02-04
**Core Value:** Enable SCMs to contribute descriptors with SA approval workflow

## v2 Requirements

### WSOS Section Management

- [x] **WSOS-01**: SCM can browse existing WSOS sections
- [x] **WSOS-02**: SCM can create new WSOS section with name
- [x] **WSOS-03**: System detects similar WSOS sections when creating (duplicate prevention)
- [x] **WSOS-04**: New WSOS sections are immediately usable (no approval needed)

### SCM Descriptor Creation

- [x] **DESC-01**: SCM can create new descriptors (extend from admin-only)
- [x] **DESC-02**: Descriptor must link to a WSOS section
- [x] **DESC-03**: SCM can select existing WSOS section or create new during descriptor creation
- [x] **DESC-04**: New SCM-created descriptors default to NEEDS_REVIEW status

### Batch Workflow

- [x] **BATCH-01**: SCM can add multiple descriptors before submitting
- [x] **BATCH-02**: Pending descriptors shown in draft state before submission
- [x] **BATCH-03**: SCM clicks "Submit for Review" to send batch to SA

### SA Approval

- [x] **APPR-01**: SA sees pending descriptors from their skill's SCM
- [x] **APPR-02**: SA can approve descriptor (status changes to GOOD)
- [x] **APPR-03**: SA can edit descriptor wording before approving
- [x] **APPR-04**: System tracks modification flag when wording was changed
- [x] **APPR-05**: SA can return descriptor with comments (not approved)
- [x] **APPR-06**: SCM can edit and resubmit returned descriptors

### Email Notifications

- [ ] **NOTIF-01**: Email to SA when SCM submits batch for review
- [ ] **NOTIF-02**: Email to SCM when descriptors approved
- [ ] **NOTIF-03**: Approval email indicates if wording was modified
- [ ] **NOTIF-04**: Email to SCM when descriptors returned with comments
- [ ] **NOTIF-05**: Email to SA when SCM resubmits revised descriptors

## Previous Milestone (v1.0) — Complete

All v1.0 Descriptor Library requirements have been completed:

- [x] Data Import & Analysis (IMPORT-01 through IMPORT-08)
- [x] Descriptor Management (MANAGE-01 through MANAGE-07)
- [x] Descriptor Library Structure (LIBRARY-01 through LIBRARY-06)
- [x] Search & Discovery (SEARCH-01 through SEARCH-08)
- [x] Library UI (UI-01 through UI-10)
- [x] Access Control (ACCESS-01 through ACCESS-04)

## Future Requirements (Deferred)

Features explicitly deferred to future milestones:

- Test Project management workflows
- Issue/Dispute tracking
- Full CIS integration
- Management meetings (SA coordination meetings)
- Descriptor version history (full history, not just modification flag)
- Multi-language descriptor support

## Out of Scope

Features explicitly excluded from v2.0 milestone:

| Feature | Reason |
|---------|--------|
| AI-generated descriptors | Quality control requires human judgment |
| Automated descriptor validation | Can't judge if descriptor fits skill context |
| SA approval for WSOS sections | Reduces friction, duplicate detection sufficient |
| Version history for edits | Flag modification is sufficient, simpler |
| Multi-language support | English only, defer translation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WSOS-01 | Phase 6 | Complete |
| WSOS-02 | Phase 6 | Complete |
| WSOS-03 | Phase 6 | Complete |
| WSOS-04 | Phase 6 | Complete |
| DESC-01 | Phase 7 | Complete |
| DESC-02 | Phase 7 | Complete |
| DESC-03 | Phase 7 | Complete |
| DESC-04 | Phase 7 | Complete |
| BATCH-01 | Phase 7 | Complete |
| BATCH-02 | Phase 7 | Complete |
| BATCH-03 | Phase 7 | Complete |
| APPR-01 | Phase 8 | Complete |
| APPR-02 | Phase 8 | Complete |
| APPR-03 | Phase 8 | Complete |
| APPR-04 | Phase 8 | Complete |
| APPR-05 | Phase 8 | Complete |
| APPR-06 | Phase 8 | Complete |
| NOTIF-01 | Phase 9 | Pending |
| NOTIF-02 | Phase 9 | Pending |
| NOTIF-03 | Phase 9 | Pending |
| NOTIF-04 | Phase 9 | Pending |
| NOTIF-05 | Phase 9 | Pending |

**Coverage Summary:**
- v2 requirements: 17 total across 5 categories
- Phase mapping: To be finalized during roadmap creation
- All requirements will be mapped to phases

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04*
