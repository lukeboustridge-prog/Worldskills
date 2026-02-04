---
phase: 08-sa-approval-workflow
plan: 03
subsystem: api
tags: [server-actions, approval-workflow, sa, scm, prisma, zod]

dependencies:
  requires:
    - 08-01: wasModifiedDuringApproval field on Descriptor model
    - 08-02: SA query utilities (canSAReviewDescriptor)
  provides:
    - SA approval and return Server Actions
    - SCM action for editing RETURNED descriptors
  affects:
    - 08-04: SA approval UI will use these actions
    - 09: Email notifications may trigger on approval/return

tech-stack:
  added: []
  patterns:
    - SA authorization via canSAReviewDescriptor utility
    - Modification detection by comparing form values to database
    - Status transition RETURNED -> DRAFT for resubmission flow

key-files:
  created:
    - src/app/(dashboard)/hub/descriptors/pending-review/actions.ts
  modified:
    - src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts

decisions:
  - id: APPR-ACT-001
    decision: Clear all reviewer fields when RETURNED -> DRAFT
    reason: Fresh resubmission should appear as new to SA without stale comments

metrics:
  duration: 3m
  completed: 2026-02-04
---

# Phase 8 Plan 03: SA Approval Server Actions Summary

**SA approval/return actions with modification tracking and SCM resubmission flow for RETURNED descriptors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-04T04:18:14Z
- **Completed:** 2026-02-04T04:21:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created SA approval actions with automatic qualityIndicator + wasModifiedDuringApproval handling
- Created SA return action with reviewComment storage
- Extended SCM actions to allow editing RETURNED descriptors and moving back to DRAFT

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SA approval Server Actions** - `899f7f1` (feat)
2. **Task 2: Extend SCM actions for RETURNED descriptors** - `8bf9167` (feat)

## Files Created/Modified

- `src/app/(dashboard)/hub/descriptors/pending-review/actions.ts` - NEW: SA approval Server Actions with approveDescriptorAction and returnDescriptorAction
- `src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts` - MODIFIED: Added updateReturnedDescriptorAction for APPR-06

## Key Implementation Details

### SA Actions (pending-review/actions.ts)

**approveDescriptorAction:**
- Validates SA role and canSAReviewDescriptor authorization
- Compares submitted wording fields against original to detect modifications
- Sets batchStatus = APPROVED, qualityIndicator = GOOD
- Sets wasModifiedDuringApproval = true only if wording actually changed
- Sets reviewerId, reviewedAt
- Clears any previous reviewComment

**returnDescriptorAction:**
- Validates SA role and canSAReviewDescriptor authorization
- Sets batchStatus = RETURNED
- Stores reviewComment (minimum 5 characters required)
- Sets reviewerId, reviewedAt
- Keeps qualityIndicator as NEEDS_REVIEW

### SCM Actions (my-descriptors/actions.ts)

**updateReturnedDescriptorAction:**
- Validates SCM role
- Verifies ownership (createdById = user.id) AND batchStatus = RETURNED
- Updates all descriptor fields
- Changes batchStatus from RETURNED to DRAFT
- Clears reviewComment, reviewerId, reviewedAt for fresh resubmission
- SCM must explicitly call submitBatchAction to resubmit to SA

## Decisions Made

**APPR-ACT-001: Clear all reviewer fields when RETURNED -> DRAFT**
- When SCM edits a RETURNED descriptor, we clear reviewComment, reviewerId, and reviewedAt
- This ensures the resubmitted descriptor appears fresh to the SA
- The SA won't see stale comments from previous review cycle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 08-04 (SA Approval UI):
- approveDescriptorAction available for Approve button
- returnDescriptorAction available for Return button with comment dialog
- updateReturnedDescriptorAction available for SCM edit page when status is RETURNED
- All actions revalidate both /pending-review and /my-descriptors paths

---
*Phase: 08-sa-approval-workflow*
*Completed: 2026-02-04*
