---
phase: 08-sa-approval-workflow
plan: 04
subsystem: ui
tags: [next.js, react, approval-ui, sa-workflow, scm-workflow]

dependencies:
  requires:
    - 08-02: SA query utilities (getPendingDescriptorsForSA, PendingDescriptor)
    - 08-03: SA approval Server Actions (approveDescriptorAction, returnDescriptorAction, updateReturnedDescriptorAction)
  provides:
    - SA pending review page at /hub/descriptors/pending-review
    - PendingReviewCard component with expand/edit/approve/return
    - SCM edit capability for RETURNED descriptors
  affects:
    - 09: Email notifications may link to these pages

tech-stack:
  added: []
  patterns:
    - Expandable card with inline editing
    - Dialog for return comment entry
    - Conditional form action based on descriptor status
    - Role-based page access redirect

key-files:
  created:
    - src/app/(dashboard)/hub/descriptors/pending-review/page.tsx
    - src/app/(dashboard)/hub/descriptors/pending-review/components/PendingReviewCard.tsx
  modified:
    - src/app/(dashboard)/hub/descriptors/my-descriptors/page.tsx
    - src/app/(dashboard)/hub/descriptors/my-descriptors/[id]/edit/page.tsx

decisions: []

metrics:
  duration: 3m
  completed: 2026-02-04
---

# Phase 8 Plan 04: SA Approval UI Summary

**SA pending review page with expandable cards and SCM edit for RETURNED descriptors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-04T04:23:42Z
- **Completed:** 2026-02-04T04:26:30Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created SA pending review page with role check and descriptor list
- Created PendingReviewCard component with expand/collapse, inline editing, approve, and return dialog
- Updated SCM my-descriptors page to show edit button for RETURNED descriptors
- Updated SCM edit page to allow editing both DRAFT and RETURNED status with SA feedback display

## Task Commits

Each task was committed atomically:

1. **Task 1-2: SA pending review page and PendingReviewCard** - `eec6d2b` (feat)
2. **Task 3: SCM pages for RETURNED handling** - `3881f36` (feat)

## Files Created/Modified

### Created
- `src/app/(dashboard)/hub/descriptors/pending-review/page.tsx` (69 lines)
  - Server component with SA role check (redirects non-SA to /dashboard)
  - Fetches pending descriptors via getPendingDescriptorsForSA
  - Displays count via getPendingCountsForSA
  - Renders PendingReviewCard for each descriptor

- `src/app/(dashboard)/hub/descriptors/pending-review/components/PendingReviewCard.tsx` (286 lines)
  - Client component with expand/collapse chevron
  - Inline editing for criterionName and score fields
  - Approve button calls approveDescriptorAction
  - Return button opens Dialog with Textarea for comment
  - Card disappears after successful action (processed state)

### Modified
- `src/app/(dashboard)/hub/descriptors/my-descriptors/page.tsx`
  - Added Edit button with Link to edit page for RETURNED descriptors
  - Replaced placeholder comment with actual functionality

- `src/app/(dashboard)/hub/descriptors/my-descriptors/[id]/edit/page.tsx`
  - Import updateReturnedDescriptorAction
  - Allow both DRAFT and RETURNED status (canEdit check)
  - Dynamic description text based on status
  - SA feedback Card shown for RETURNED descriptors
  - Conditional form action (updateReturnedDescriptorAction for RETURNED)

## Key Implementation Details

### SA Pending Review Page
```typescript
// Role check redirects non-SA users
if (user.role !== "SA") {
  redirect("/dashboard");
}

// Parallel data fetching
const [descriptors, counts] = await Promise.all([
  getPendingDescriptorsForSA(user.id),
  getPendingCountsForSA(user.id),
]);
```

### PendingReviewCard Features
- **Expand/Collapse:** Chevron toggles expanded state to show score details
- **Edit Mode:** Edit button expands and enables input fields
- **Approve:** Sends form data to approveDescriptorAction, shows wasModified toast
- **Return:** Dialog with Textarea (min 5 chars), calls returnDescriptorAction
- **Processed State:** Card returns null after approve/return to hide

### SCM Edit Page Status Check
```typescript
const canEdit =
  descriptor.batchStatus === DescriptorBatchStatus.DRAFT ||
  descriptor.batchStatus === DescriptorBatchStatus.RETURNED;

// Form uses appropriate action
action={descriptor.batchStatus === DescriptorBatchStatus.RETURNED
  ? updateReturnedDescriptorAction
  : updateSCMDescriptorAction
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification Results

1. TypeScript compiles (`npx tsc --noEmit`) - PASSED
2. SA pending review page created with all required features - PASSED
3. PendingReviewCard has expand/edit/approve/return functionality - PASSED
4. SCM page shows edit button for RETURNED descriptors - PASSED
5. SCM edit page accepts both DRAFT and RETURNED status - PASSED
6. Edit page shows SA feedback for RETURNED descriptors - PASSED

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 8 (SA Approval Workflow) is now complete:
- SA can access /hub/descriptors/pending-review to see their SCMs' pending descriptors
- SA can approve descriptors (with or without inline edits)
- SA can return descriptors with feedback comment
- SCM can see RETURNED descriptors with SA comment
- SCM can edit RETURNED descriptors to address feedback
- Saving RETURNED descriptor moves to DRAFT for resubmission

Ready for Phase 9 (Email Notifications) if planned.

---
*Phase: 08-sa-approval-workflow*
*Completed: 2026-02-04*
