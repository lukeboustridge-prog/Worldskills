---
phase: 02-permission-business-logic
plan: 02
subsystem: business-logic
tags: [server-actions, permissions, meeting-management, role-based-access, zod-validation]

# Dependency graph
requires:
  - phase: 02-01
    provides: Permission helpers (canCreateManagementMeeting, canManageMeeting) and activity logging
provides:
  - Server actions for management meeting CRUD with authorization
  - Meeting visibility queries with role-based filtering
  - Secretariat member lookup for attendee selection
  - Document and link management for management meetings
affects: [ui-layer, meeting-pages, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action pattern with Zod validation and permission checks"
    - "Role-based meeting visibility filtering in queries"
    - "Non-blocking storage cleanup with error logging"

key-files:
  created:
    - src/app/(dashboard)/management-meeting-actions.ts
    - src/lib/meeting-queries.ts
  modified: []

key-decisions:
  - "All 7 server actions validate meeting.skillId === null to prevent cross-contamination with skill meetings"
  - "Email invitations sent to all SAs plus selected Secretariat members on meeting creation"
  - "Secretariat members selected at creation time, stored in MeetingAttendee junction table"
  - "SA role sees all management meetings automatically (no attendee record needed)"
  - "Secretariat role sees only management meetings they're explicitly invited to"

patterns-established:
  - "Server action signature for management meetings: no skillId parameter (vs skill meetings which require it)"
  - "Activity logging with skillId: null for management meeting actions"
  - "Path revalidation pattern: both /meetings and /hub/meetings after mutations"

# Metrics
duration: 5min
completed: 2026-02-01
---

# Phase 02 Plan 02: Management Meeting Actions & Queries Summary

**Server actions for management meeting CRUD with role-based authorization, email invitations, and meeting visibility queries**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-01T03:16:36Z
- **Completed:** 2026-02-01T03:21:30Z
- **Tasks:** 5
- **Files modified:** 2

## Accomplishments
- Created 7 server actions for management meeting operations (create, update minutes, delete, add/delete documents, add/remove links)
- Implemented role-based meeting visibility queries (Admin, SA, SCM, Secretariat, SkillTeam)
- Email invitations sent to all SAs and selected Secretariat on meeting creation
- Permission checks enforce authorization rules from 02-01
- Activity logging works with null skillId for management meetings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create and update management meeting actions** - `22b59fa` (feat)
2. **Task 2: Add delete management meeting action** - `fe27906` (feat)
3. **Task 3: Add document management actions** - `4ef43c5` (feat)
4. **Task 4: Add link management actions** - `1d3ec6b` (feat)
5. **Task 5: Create meeting visibility queries** - `bec11bc` (feat)

## Files Created/Modified
- `src/app/(dashboard)/management-meeting-actions.ts` - Server actions for management meeting CRUD, documents, and links with Zod validation and permission checks
- `src/lib/meeting-queries.ts` - Role-based meeting retrieval and Secretariat member lookup functions

## Decisions Made
- **Email recipients for management meetings:** All SAs receive invitations (always), plus selected Secretariat members. SAs don't need MeetingAttendee records (they can view all management meetings by role), but Secretariat members must be explicitly invited.
- **Meeting type enforcement:** All actions validate `meeting.skillId === null` to ensure they only operate on management meetings, preventing accidental cross-contamination with skill meetings.
- **Secretariat visibility:** Unlike SAs who see all management meetings, Secretariat members only see meetings where they have a MeetingAttendee record (principle of least privilege).
- **Storage cleanup pattern:** Document deletion uses non-blocking storage cleanup with error logging (same pattern as skill meetings).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Management meeting server actions and queries are complete. Ready for:
- UI layer to call these actions (forms, buttons)
- Meeting list pages to use getMeetingsForUser for role-based display
- Secretariat member selection UI using getSecretariatMembers

All requirements from AUTH-01 to AUTH-06, MEET-01 to MEET-08, EMAIL-01 to EMAIL-03, and SAFE-03 are satisfied.

---
*Phase: 02-permission-business-logic*
*Completed: 2026-02-01*
