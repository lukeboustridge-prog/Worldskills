# Roadmap: Management Meetings Feature

## Overview

The management meetings feature extends the existing skill meeting system to support coordination meetings for Skill Advisors and Secretariat members. This roadmap delivers four phases that progressively build from database foundation through business logic, UI integration, and deployment validation. Each phase maintains backward compatibility with existing skill meetings while introducing role-based visibility and selective attendance capabilities.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Database Foundation & Type System** - Schema changes for optional skill association and attendee tracking
- [ ] **Phase 2: Permission & Business Logic Layer** - Authorization, email generation, and visibility rules for both meeting types
- [ ] **Phase 3: UI Integration & Components** - Meeting creation, display, and filtering with visual distinction
- [ ] **Phase 4: Deployment & Validation** - Production deployment with data migration validation and rollback capability

## Phase Details

### Phase 1: Database Foundation & Type System
**Goal**: Database schema supports both skill-specific and management meetings with selective attendance tracking
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. Meeting can be created without skillId (NULL references handled correctly)
  2. MeetingAttendee records persist for management meetings with selected Secretariat members
  3. Existing skill meetings remain functional with no data loss after migration
  4. TypeScript types reflect optional Meeting.skill relation throughout codebase
**Plans**: TBD

Plans:
- [ ] 01-01: TBD during planning

### Phase 2: Permission & Business Logic Layer
**Goal**: Backend correctly authorizes, emails, and filters meetings based on role and meeting type
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, MEET-01, MEET-02, MEET-03, MEET-04, MEET-05, MEET-06, MEET-07, MEET-08, EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Skill Advisor can view all management meetings plus their own skill meetings
  2. Secretariat member can view only management meetings they're invited to
  3. Only Admins and Secretariat can create, edit, or delete management meetings
  4. Management meeting creation sends calendar invites to all SAs and selected Secretariat members
  5. Email templates correctly identify meeting type (Skill Meeting vs Skill Advisor Meeting)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD during planning

### Phase 3: UI Integration & Components
**Goal**: Users can create, view, filter, and distinguish between skill and management meetings in unified interface
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08
**Success Criteria** (what must be TRUE):
  1. Skill meetings display "Skill Meeting" badge, management meetings display "Skill Advisor Meeting" badge
  2. Meetings hub shows both skill and management meetings in single list
  3. Admin can create management meeting with attendee selector for Secretariat members
  4. User can filter meetings by type (skill vs management)
  5. Meeting detail page displays attendee list for management meetings
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during planning

### Phase 4: Deployment & Validation
**Goal**: Management meetings feature deployed to production with validated data integrity and rollback capability
**Depends on**: Phase 3
**Requirements**: SAFE-01, SAFE-02, SAFE-04
**Success Criteria** (what must be TRUE):
  1. All existing skill meetings render correctly after production deployment
  2. Database migration completes without data loss or constraint violations
  3. Feature flag enables instant rollback if issues detected
  4. Post-deployment validation confirms NULL skill references handled safely across all components
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Foundation & Type System | 0/TBD | Not started | - |
| 2. Permission & Business Logic Layer | 0/TBD | Not started | - |
| 3. UI Integration & Components | 0/TBD | Not started | - |
| 4. Deployment & Validation | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-01*
*Last updated: 2026-02-01 after initial creation*
