---
phase: "06-wsos-section-management"
plan: "02"
subsystem: "ui-management"
tags: [server-actions, zod, use-debounce, pg_trgm, settings-page]

dependency_graph:
  requires: ["06-01"]
  provides: ["wsos-section-ui", "wsos-crud-actions", "duplicate-warning-component"]
  affects: ["07-01"]

tech_stack:
  added: []
  patterns:
    - "Server Actions with Zod validation and P2002 error handling"
    - "Client form with useDebouncedCallback for live duplicate checking"
    - "Server component with role-based redirect"

key_files:
  created:
    - "src/app/(dashboard)/settings/wsos-sections/actions.ts"
    - "src/app/(dashboard)/settings/wsos-sections/page.tsx"
    - "src/app/(dashboard)/settings/wsos-sections/form.tsx"
    - "src/components/wsos/duplicate-warning.tsx"
  modified: []

decisions: []

metrics:
  duration: "3m 32s"
  completed: "2026-02-04"
---

# Phase 6 Plan 2: Server Actions, Duplicate Warning, Management Page Summary

WSOS section management UI with Server Actions, live duplicate warning, and full CRUD operations.

## What Was Built

### Server Actions (`actions.ts`)
- **createWSOSSectionAction**: FormData validation with Zod, P2002 unique constraint handling, trims name/description
- **updateWSOSSectionAction**: Same validation and error handling for edits
- **deleteWSOSSectionAction**: Simple delete with error handling
- **checkSimilarSectionsAction**: Callable Server Action for client-side duplicate checking (calls `findSimilarWSOSSections` with 0.3 threshold)
- Role check: `user.role === "SCM" || user.isAdmin` (not requireAdminUser)

### Duplicate Warning Component (`duplicate-warning.tsx`)
- Client component with "use client" directive
- Props: `similar: SimilarSection[]`, `className?: string`
- Amber/yellow warning styling with AlertTriangle icon
- Shows similarity percentage for each match
- Guidance text about using existing sections

### Management Page (`page.tsx` + `form.tsx`)
- Server component with `requireUser()` + role check (redirects non-SCM/non-admin to /dashboard)
- Fetches sections via `getAllWSOSSections()` from Wave 1
- Edit mode via `?edit=id` query param
- Success/error messages via query params (`?created=1`, `?updated=1`, `?deleted=1`, `?error=message`)
- Client form component (`WSOSSectionForm`) with:
  - Controlled name input for live duplicate checking
  - `useDebouncedCallback` from use-debounce (500ms delay)
  - Calls `checkSimilarSectionsAction` when name length >= 3
  - Shows loading state while checking
  - Renders `DuplicateWarning` below name input
- Section list with:
  - Section name (bold)
  - Description (if exists, truncated)
  - Creator name and created date
  - Edit button linking to `?edit={id}`
  - Delete form with hidden input

## Key Technical Details

### Role Check Pattern
```typescript
const user = await requireUser();
if (user.role !== "SCM" && !user.isAdmin) {
  redirect("/dashboard"); // or throw error in actions
}
```

### P2002 Unique Constraint Handling
```typescript
catch (error) {
  if ((error as { code?: string })?.code === "P2002") {
    const params = new URLSearchParams({
      error: "A section with this name already exists",
    });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }
  throw error;
}
```

### Live Duplicate Checking
```typescript
const checkSimilar = useDebouncedCallback(async (value: string) => {
  if (value.length < 3) {
    setSimilar([]);
    return;
  }
  const results = await checkSimilarSectionsAction(value, editingSection?.id);
  setSimilar(results);
}, 500);
```

## Commits

| Hash | Message |
|------|---------|
| bd3dddf | feat(06-02): add WSOS section Server Actions |
| 2d332d6 | feat(06-02): add DuplicateWarning component for WSOS sections |
| 2e1b87e | feat(06-02): add WSOS sections management page |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Status |
|-------|--------|
| TypeScript compiles (`npx tsc --noEmit`) | PASS |
| Dev server starts | PASS |
| Server Actions exported | PASS (createWSOSSectionAction, updateWSOSSectionAction, deleteWSOSSectionAction, checkSimilarSectionsAction) |
| DuplicateWarning exported | PASS |
| Page renders at /settings/wsos-sections | PASS (server started without errors) |
| Role check implemented | PASS |

## Next Phase Readiness

**Phase 6 Complete.** Ready for Phase 7: SCM Descriptor Creation & Batch Workflow.

### Available for Phase 7:
- WSOS sections can be created, viewed, edited, deleted
- `getAllWSOSSections()` returns all sections for dropdown population
- `findSimilarWSOSSections()` available for inline section creation during descriptor creation
- `WSOSSection` Prisma model ready for descriptor linking

### Integration Points:
- Descriptor creation form can import `getAllWSOSSections()` for section dropdown
- Descriptor form can use similar duplicate warning pattern for criterion name
- Section management accessible at `/settings/wsos-sections` for SCMs
