---
phase: 02-permission-business-logic
plan: 01
subsystem: auth
tags: [permissions, authorization, email, activity-logging, role-based-access]

# Dependency graph
requires:
  - phase: 01-database-foundation-&-type-system
    provides: Meeting model with optional skillId, Role enum, Prisma schema
provides:
  - Meeting permission check functions (canCreateManagementMeeting, canViewMeeting, canManageMeeting)
  - Meeting-type-aware email templates (skill vs management)
  - Activity logging with optional skillId support
affects: [02-02, api-routes, meeting-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure permission functions with lightweight TypeScript interfaces
    - Email template conditional rendering based on meeting type
    - Sentinel value pattern for optional foreign keys

key-files:
  created:
    - src/lib/permissions/meeting.ts
  modified:
    - src/lib/email/meeting-invitation.ts
    - src/lib/activity.ts

key-decisions:
  - "Use sentinel value 'MANAGEMENT' for null skillId in activity logs (deferred schema migration)"
  - "Make MeetingDetails.skillName optional with backward compatibility"
  - "Meeting type determined by explicit flag or skillName presence"
  - "Secretariat can view management meetings only if they're attendees"

patterns-established:
  - "Permission functions: pure, testable, tree-shakeable (no Prisma imports in permission layer)"
  - "Email templates: conditional rendering based on meeting type with fallbacks"
  - "Activity logging: sentinel values for optional relations until schema migration"

# Metrics
duration: 4min
completed: 2026-02-01
---

# Phase 2 Plan 1: Authorization Foundation Summary

**Permission checking, meeting-type-aware emails, and activity logging foundation for management meetings**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-01T03:09:53Z
- **Completed:** 2026-02-01T03:13:38Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created reusable permission check functions for management and skill meetings
- Email templates now differentiate between skill and management meeting types
- Activity logging accepts null skillId using sentinel value pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create meeting permission helpers** - `5457282` (feat)
2. **Task 2: Update email template for meeting type** - `70f6105` (feat)
3. **Task 3: Update activity logging for optional skillId** - `84ff8ec` (feat)

## Files Created/Modified
- `src/lib/permissions/meeting.ts` - Pure permission functions: canCreateManagementMeeting, canViewMeeting, canManageMeeting
- `src/lib/email/meeting-invitation.ts` - Meeting-type-aware email with skill/management variants
- `src/lib/activity.ts` - Activity logging with skillId: string | null support

## Decisions Made

1. **Sentinel value for activity logs**: Used "MANAGEMENT" string as sentinel for null skillId instead of schema migration
   - Rationale: ActivityLog.skillId is required in schema. Sentinel value keeps logging unified and queryable without immediate migration
   - TODO added for future schema migration

2. **Meeting type determination**: Explicit meetingType parameter with fallback to skillName presence
   - Rationale: Allows callers to be explicit, but maintains backward compatibility with existing code that only passes skillName

3. **Secretariat view permissions**: Secretariat can only view management meetings they attend
   - Rationale: More restrictive than SA (who can view all), follows principle of least privilege

4. **Lightweight permission interfaces**: No Prisma imports in permission layer
   - Rationale: Keeps module tree-shakeable and testable without database dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks executed cleanly with pre-existing TypeScript errors unrelated to changes.

## Next Phase Readiness

Foundation ready for Plan 02-02 which will:
- Use these permission functions in API routes
- Send meeting-type-aware emails from meeting creation endpoints
- Log activities for management meetings using null skillId support

No blockers. All three building blocks (permissions, email, activity logging) are in place.

---
*Phase: 02-permission-business-logic*
*Completed: 2026-02-01*
