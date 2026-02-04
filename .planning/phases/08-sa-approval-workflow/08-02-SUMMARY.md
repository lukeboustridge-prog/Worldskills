---
phase: 08-sa-approval-workflow
plan: 02
subsystem: query-layer
tags: [prisma, typescript, sa-approval, query-utilities]
dependencies:
  requires:
    - 08-01: wasModifiedDuringApproval field on Descriptor
    - 07: SCM batch workflow with createdById, batchStatus
  provides:
    - getPendingDescriptorsForSA function
    - getPendingCountsForSA function
    - canSAReviewDescriptor function
    - PendingDescriptor type
  affects:
    - 08-03: SA approval Server Actions will use these utilities
    - 08-04: SA pending review page will call these functions
tech-stack:
  added: []
  patterns:
    - Two-step query through Skill to find SCM-SA relationship
    - Type inference from Prisma return type
key-files:
  created:
    - src/lib/sa-approval.ts
  modified: []
decisions: []
metrics:
  duration: 2m
  completed: 2026-02-04
---

# Phase 8 Plan 02: SA Query Utilities Summary

**One-liner:** Query utilities for SA approval workflow implementing APPR-01 permission model (SA sees only their skill's SCM descriptors).

## What Was Built

Created `src/lib/sa-approval.ts` with three query functions that implement the core permission model for SA approval workflow:

### Functions

**getPendingDescriptorsForSA(saUserId)**
- Finds all skills where `saId = userId`
- Extracts `scmId` values from those skills
- Queries descriptors where `createdById IN scmIds` AND `batchStatus = PENDING_REVIEW`
- Returns descriptors with `wsosSection` and `createdBy` relations
- Orders by `submittedAt` ascending (FIFO review)

**getPendingCountsForSA(saUserId)**
- Same two-step query pattern
- Returns `{ total: number }` for badge displays

**canSAReviewDescriptor(saUserId, descriptorId)**
- Validates descriptor is in PENDING_REVIEW status
- Confirms `createdById` matches an SCM assigned to a skill the SA manages
- Returns boolean for authorization checks

### Type Export

**PendingDescriptor**
- Inferred from `getPendingDescriptorsForSA` return type
- Includes `wsosSection: { id, name }` and `createdBy: { id, name, email }`

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 3531231 | feat | Add SA approval query utilities |

## Verification Results

1. `npx tsc --noEmit` - Passed, no TypeScript errors
2. File has 111 lines (exceeds 80 minimum)
3. All three functions exported
4. PendingDescriptor type exported
5. Key patterns verified:
   - `saId = userId` query through Skill model
   - `createdById: { in: scmIds }` filter on Descriptor

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 08-03 (SA Approval Server Actions):
- `getPendingDescriptorsForSA` available for page data fetching
- `canSAReviewDescriptor` available for action authorization
- `PendingDescriptor` type available for component props
