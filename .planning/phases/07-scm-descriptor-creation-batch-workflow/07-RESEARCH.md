# Phase 7: SCM Descriptor Creation & Batch Workflow - Research

**Researched:** 2026-02-04
**Domain:** Descriptor creation with WSOS section linking and batch submission workflow
**Confidence:** HIGH

## Summary

This phase enables SCMs to create descriptors that link to WSOS sections (built in Phase 6) and batch multiple descriptors before submitting them for SA review. The key technical decisions are: (1) extending the existing Descriptor model with a wsosSection foreign key, (2) adding batch tracking fields (batchId, batchStatus, submittedAt) to group descriptors for submission, and (3) building an SCM descriptor creation UI that reuses existing patterns while adding WSOS section selection with inline creation capability.

The research confirms that all required infrastructure exists: WSOSSection model with duplicate detection, admin descriptor CRUD patterns in /settings/descriptors, CreateDescriptorModal pattern in /hub/descriptors/review, and Server Actions patterns throughout the codebase. The SCM-SA relationship is tracked via the Skill model (Skill.saId and Skill.scmId), which will be used to route submitted batches to the correct SA.

**Primary recommendation:** Extend Descriptor with wsosSection relation and batch fields, create SCM descriptor management at /hub/descriptors/my-descriptors (not /settings, which is admin-focused), use status-based batch workflow (DRAFT -> PENDING_REVIEW) rather than separate DescriptorBatch model.

## Standard Stack

All required technologies are already in the project. No new dependencies needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 5.20.0 | ORM with schema extension | Project standard for all models |
| Next.js 14 | 14.2.10 | Server Actions for CRUD | Project framework |
| PostgreSQL | - | Relational storage with enums | Already configured with QualityIndicator enum |
| NextAuth | 4.24.7 | SCM role checking | Existing auth infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.23.8 | Form validation | All Server Actions use Zod schemas |
| use-debounce | 10.0.4 | Debounced duplicate checking | Already used in WSOSSectionForm for live checking |
| Radix UI | Various | Dialog, Select components | For WSOS section dropdown and inline creation modal |
| date-fns | 3.6.0 | Date formatting | Display submitted/created dates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Status-based batching | Separate DescriptorBatch model | Status-based is simpler, fewer tables, matches QualityIndicator pattern already used |
| /hub/descriptors/my-descriptors | /settings/descriptors | /settings is admin-focused; /hub is user-facing workspace |
| wsosSection relation | wsosSectionId string field | Relation provides type safety, cascade behavior, eager loading |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma                      # Extend Descriptor model

src/
  app/(dashboard)/
    hub/
      descriptors/
        my-descriptors/              # NEW: SCM descriptor management
          page.tsx                   # List SCM's descriptors with batch UI
          create/
            page.tsx                 # Create descriptor form
          [id]/
            edit/
              page.tsx               # Edit draft descriptor
          actions.ts                 # SCM-specific Server Actions
  components/
    descriptors/
      wsos-section-select.tsx        # Dropdown with inline create
  lib/
    scm-descriptors.ts               # Query utilities for SCM workflow
```

### Pattern 1: Descriptor Model Extension
**What:** Add wsosSection relation and batch tracking fields to Descriptor
**When to use:** Required for Phase 7 - every descriptor needs WSOS section linking
**Example:**
```prisma
// prisma/schema.prisma

// New batch status enum (simpler than separate model)
enum DescriptorBatchStatus {
  DRAFT           // Not yet submitted, SCM can edit/delete
  PENDING_REVIEW  // Submitted to SA, awaiting approval
  APPROVED        // SA approved (status changes to GOOD quality)
  RETURNED        // SA returned with comments, SCM can revise
}

model Descriptor {
  // ... existing fields ...

  // WSOS Section linking (required for SCM-created)
  wsosSectionId String?
  wsosSection   WSOSSection? @relation(fields: [wsosSectionId], references: [id])

  // Batch workflow fields
  batchStatus   DescriptorBatchStatus?  // null for admin/imported descriptors
  batchId       String?                  // Groups descriptors in same submission
  createdById   String?                  // SCM who created (null for imported)
  createdBy     User?                    @relation("DescriptorCreator", fields: [createdById], references: [id])
  submittedAt   DateTime?                // When batch was submitted
  reviewerId    String?                  // SA who reviewed
  reviewer      User?                    @relation("DescriptorReviewer", fields: [reviewerId], references: [id])
  reviewedAt    DateTime?                // When review completed
  reviewComment String?                  @db.Text  // SA's feedback if returned

  @@index([wsosSectionId])
  @@index([batchStatus])
  @@index([batchId])
  @@index([createdById])
}

model WSOSSection {
  // ... existing fields ...

  descriptors Descriptor[]  // Add inverse relation
}

model User {
  // ... existing relations ...

  descriptorsCreated  Descriptor[]  @relation("DescriptorCreator")
  descriptorsReviewed Descriptor[]  @relation("DescriptorReviewer")
}
```

### Pattern 2: WSOS Section Selection with Inline Creation
**What:** Dropdown component that lists existing sections with option to create new inline
**When to use:** Descriptor creation/edit form
**Example:**
```typescript
// src/components/descriptors/wsos-section-select.tsx
"use client";

import { useState, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { DuplicateWarning } from "@/components/wsos/duplicate-warning";
import { checkSimilarSectionsAction, createWSOSSectionAction } from "@/app/(dashboard)/settings/wsos-sections/actions";
import type { WSOSSectionWithCreator, SimilarSection } from "@/lib/wsos-sections";

interface WSOSSectionSelectProps {
  sections: WSOSSectionWithCreator[];
  value: string;
  onChange: (value: string) => void;
  onSectionCreated: (newSection: WSOSSectionWithCreator) => void;
}

export function WSOSSectionSelect({
  sections,
  value,
  onChange,
  onSectionCreated,
}: WSOSSectionSelectProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState<SimilarSection[]>([]);
  const [isPending, startTransition] = useTransition();

  const checkSimilar = useDebouncedCallback(async (name: string) => {
    if (name.length < 3) {
      setSimilar([]);
      return;
    }
    const results = await checkSimilarSectionsAction(name);
    setSimilar(results);
  }, 500);

  const handleCreateSection = () => {
    // Create section and refresh list
    startTransition(async () => {
      // Server action to create section
      // Then call onSectionCreated with new section
      setCreateOpen(false);
    });
  };

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select WSOS section..." />
        </SelectTrigger>
        <SelectContent>
          {sections.map((section) => (
            <SelectItem key={section.id} value={section.id}>
              {section.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New WSOS Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                checkSimilar(e.target.value);
              }}
              placeholder="Section name..."
            />
            <DuplicateWarning similar={similar} />
            <Button onClick={handleCreateSection} disabled={isPending}>
              Create Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### Pattern 3: Status-Based Batch Workflow
**What:** Use batchId field to group descriptors, batchStatus to track workflow state
**When to use:** SCM creates descriptors -> adds to draft -> submits batch -> SA reviews
**Example:**
```typescript
// src/lib/scm-descriptors.ts

import { DescriptorBatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Get all descriptors created by an SCM, grouped by batch status
 */
export async function getSCMDescriptors(userId: string) {
  return prisma.descriptor.findMany({
    where: {
      createdById: userId,
      deletedAt: null,
    },
    include: {
      wsosSection: true,
    },
    orderBy: [
      { batchStatus: "asc" },  // DRAFT first, then PENDING, etc.
      { updatedAt: "desc" },
    ],
  });
}

/**
 * Get draft descriptors for current batch (not yet submitted)
 */
export async function getDraftDescriptors(userId: string) {
  return prisma.descriptor.findMany({
    where: {
      createdById: userId,
      batchStatus: DescriptorBatchStatus.DRAFT,
      deletedAt: null,
    },
    include: {
      wsosSection: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Submit batch: update all DRAFT descriptors to PENDING_REVIEW
 */
export async function submitBatch(userId: string) {
  const batchId = crypto.randomUUID();
  const now = new Date();

  await prisma.descriptor.updateMany({
    where: {
      createdById: userId,
      batchStatus: DescriptorBatchStatus.DRAFT,
      deletedAt: null,
    },
    data: {
      batchStatus: DescriptorBatchStatus.PENDING_REVIEW,
      batchId,
      submittedAt: now,
    },
  });

  return { batchId, submittedAt: now };
}

/**
 * Get the SA for this SCM based on skill assignment
 */
export async function getSAForSCM(scmUserId: string) {
  const skill = await prisma.skill.findFirst({
    where: { scmId: scmUserId },
    include: {
      sa: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return skill?.sa ?? null;
}
```

### Pattern 4: SCM Descriptor Create Action
**What:** Server Action for SCM to create descriptor with mandatory WSOS section
**When to use:** Form submission in /hub/descriptors/my-descriptors/create
**Example:**
```typescript
// src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts
"use server";

import { DescriptorBatchStatus, QualityIndicator } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createDescriptorSchema = z.object({
  code: z.string().min(1, "Code is required"),
  criterionName: z.string().min(5, "Criterion name must be at least 5 characters"),
  wsosSectionId: z.string().min(1, "WSOS section is required"),  // Required for SCM
  score3: z.string().optional(),
  score2: z.string().optional(),
  score1: z.string().optional(),
  score0: z.string().optional(),
  tags: z.string().optional(),
}).refine(
  (data) => data.score3 || data.score2 || data.score1 || data.score0,
  { message: "At least one performance level description is required" }
);

export async function createSCMDescriptorAction(formData: FormData) {
  const user = await requireUser();

  // Only SCMs can create through this action
  if (user.role !== "SCM") {
    throw new Error("Only SCMs can create descriptors through this interface");
  }

  const parsed = createDescriptorSchema.safeParse({
    code: formData.get("code"),
    criterionName: formData.get("criterionName"),
    wsosSectionId: formData.get("wsosSectionId"),
    score3: formData.get("score3") || undefined,
    score2: formData.get("score2") || undefined,
    score1: formData.get("score1") || undefined,
    score0: formData.get("score0") || undefined,
    tags: formData.get("tags") || undefined,
  });

  if (!parsed.success) {
    const error = parsed.error.errors[0]?.message ?? "Invalid input";
    const params = new URLSearchParams({ error });
    return redirect(`/hub/descriptors/my-descriptors/create?${params.toString()}`);
  }

  const data = parsed.data;
  const tags = data.tags?.split(",").map(t => t.trim()).filter(Boolean) ?? [];

  try {
    await prisma.descriptor.create({
      data: {
        code: data.code.trim(),
        criterionName: data.criterionName.trim(),
        wsosSectionId: data.wsosSectionId,
        score3: data.score3?.trim() || null,
        score2: data.score2?.trim() || null,
        score1: data.score1?.trim() || null,
        score0: data.score0?.trim() || null,
        tags,
        source: "SCM",  // Distinguish from WSC2024/Manual
        qualityIndicator: QualityIndicator.NEEDS_REVIEW,  // Required by DESC-04
        batchStatus: DescriptorBatchStatus.DRAFT,  // Starts as draft
        createdById: user.id,
      },
    });
  } catch (error) {
    console.error("Failed to create descriptor", error);
    const params = new URLSearchParams({ error: "Failed to create descriptor" });
    return redirect(`/hub/descriptors/my-descriptors/create?${params.toString()}`);
  }

  revalidatePath("/hub/descriptors/my-descriptors");
  const params = new URLSearchParams({ created: "1" });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}

export async function submitBatchAction() {
  const user = await requireUser();

  if (user.role !== "SCM") {
    throw new Error("Only SCMs can submit batches");
  }

  const batchId = crypto.randomUUID();
  const now = new Date();

  const result = await prisma.descriptor.updateMany({
    where: {
      createdById: user.id,
      batchStatus: DescriptorBatchStatus.DRAFT,
      deletedAt: null,
    },
    data: {
      batchStatus: DescriptorBatchStatus.PENDING_REVIEW,
      batchId,
      submittedAt: now,
    },
  });

  if (result.count === 0) {
    const params = new URLSearchParams({ error: "No draft descriptors to submit" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  // Phase 9 will add email notification here

  revalidatePath("/hub/descriptors/my-descriptors");
  const params = new URLSearchParams({ submitted: String(result.count) });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}
```

### Anti-Patterns to Avoid
- **Separate DescriptorBatch model:** Adds complexity; status field on Descriptor achieves same result
- **Admin descriptor route for SCMs:** /settings/descriptors is admin-only; SCMs use /hub/descriptors/my-descriptors
- **Global descriptor visibility:** SCMs should only see their own drafts and submitted descriptors
- **Optional WSOS section:** DESC-02 requires every SCM-created descriptor links to a section
- **Auto-submit on create:** BATCH-01 requires explicit batch submission action

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WSOS section dropdown | Custom select | getAllWSOSSections() + Radix Select | Function and component already exist |
| Duplicate section detection | Manual comparison | checkSimilarSectionsAction() | Already has debounce, threshold tuning |
| Role checking | Custom middleware | requireUser() + role check | Pattern used throughout codebase |
| Form validation | Manual checks | Zod schemas | Type-safe, consistent error messages |
| SCM-SA relationship | New table | Skill.saId/scmId | Already tracks which SA manages which SCM |

**Key insight:** Phase 6 established WSOS section management. Phase 7 reuses those utilities and adds the descriptor-section relation.

## Common Pitfalls

### Pitfall 1: Making WSOS Section Optional for SCM Descriptors
**What goes wrong:** Orphaned descriptors with no section, violating DESC-02
**Why it happens:** Schema allows null wsosSectionId for backward compatibility with imported descriptors
**How to avoid:** Zod schema in SCM actions requires wsosSectionId; only admin actions allow null
**Warning signs:** SCM creates descriptor without section selection

### Pitfall 2: Not Filtering Descriptors by Creator
**What goes wrong:** SCM sees all descriptors including others' drafts
**Why it happens:** Reusing admin query patterns that show all descriptors
**How to avoid:** Always filter by createdById in SCM queries
**Warning signs:** SCM's "My Descriptors" page shows descriptors they didn't create

### Pitfall 3: Batch Submission Without Draft Check
**What goes wrong:** Empty submission or submitting already-submitted descriptors
**Why it happens:** Not checking batchStatus before update
**How to avoid:** submitBatch action must filter WHERE batchStatus = DRAFT
**Warning signs:** result.count is 0 or descriptors have wrong batchId

### Pitfall 4: Forgetting SCM-SA Skill Relationship
**What goes wrong:** Batch submitted but SA can't find it (routes to wrong SA)
**Why it happens:** Not using Skill.saId to determine which SA should review
**How to avoid:** Query Skill where scmId = user.id, then use skill.saId for SA lookup
**Warning signs:** SA's review queue is empty despite SCM submission

### Pitfall 5: Admin and SCM Descriptor Routes Conflicting
**What goes wrong:** URL confusion, permission errors, wrong UI patterns
**Why it happens:** Trying to use same route for both roles
**How to avoid:** Clear separation:
  - Admin: /settings/descriptors (full CRUD, all descriptors)
  - SCM: /hub/descriptors/my-descriptors (own descriptors only, batch workflow)
**Warning signs:** SCM trying to access /settings/descriptors, admin seeing batch UI

### Pitfall 6: Not Preserving Existing Categories Field
**What goes wrong:** Breaking existing descriptor structure that uses categories array
**Why it happens:** Assuming wsosSection replaces categories
**How to avoid:** wsosSection is additional linkage; categories remains for backward compatibility
**Warning signs:** Existing descriptors lose category data after migration

## Code Examples

Verified patterns from existing codebase:

### Draft Batch Page UI
```typescript
// src/app/(dashboard)/hub/descriptors/my-descriptors/page.tsx
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDraftDescriptors, getSCMDescriptors } from "@/lib/scm-descriptors";
import { submitBatchAction } from "./actions";

export default async function MyDescriptorsPage({
  searchParams,
}: {
  searchParams?: { created?: string; submitted?: string; error?: string };
}) {
  const user = await requireUser();

  if (user.role !== "SCM") {
    redirect("/dashboard");
  }

  const descriptors = await getSCMDescriptors(user.id);
  const draftDescriptors = descriptors.filter(d => d.batchStatus === "DRAFT");
  const pendingDescriptors = descriptors.filter(d => d.batchStatus === "PENDING_REVIEW");

  return (
    <div className="space-y-6">
      <h1>My Descriptors</h1>

      {/* Success messages */}
      {searchParams?.created && <Alert>Descriptor created as draft</Alert>}
      {searchParams?.submitted && <Alert>Batch submitted ({searchParams.submitted} descriptors)</Alert>}

      {/* Draft batch section */}
      <Card>
        <CardHeader>
          <CardTitle>Draft Batch</CardTitle>
          <CardDescription>
            {draftDescriptors.length} descriptor(s) ready to submit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draftDescriptors.map(d => (
            <DescriptorCard key={d.id} descriptor={d} showEditDelete />
          ))}

          {draftDescriptors.length > 0 && (
            <form action={submitBatchAction}>
              <Button type="submit">Submit for Review</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Pending review section */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Review</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingDescriptors.map(d => (
            <DescriptorCard key={d.id} descriptor={d} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Descriptor Create Form with WSOS Section
```typescript
// src/app/(dashboard)/hub/descriptors/my-descriptors/create/page.tsx
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllWSOSSections } from "@/lib/wsos-sections";
import { WSOSSectionSelect } from "@/components/descriptors/wsos-section-select";
import { createSCMDescriptorAction } from "../actions";

export default async function CreateDescriptorPage() {
  const user = await requireUser();

  if (user.role !== "SCM") {
    redirect("/dashboard");
  }

  const sections = await getAllWSOSSections();

  return (
    <div className="space-y-6">
      <h1>Create Descriptor</h1>

      <form action={createSCMDescriptorAction} className="space-y-4">
        <div>
          <Label htmlFor="wsosSectionId">WSOS Section *</Label>
          <WSOSSectionSelectServer sections={sections} name="wsosSectionId" />
        </div>

        <div>
          <Label htmlFor="code">Code *</Label>
          <Input id="code" name="code" placeholder="A1" required />
        </div>

        <div>
          <Label htmlFor="criterionName">Criterion Name *</Label>
          <Input id="criterionName" name="criterionName" required />
        </div>

        {/* Performance level textareas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="score3">Excellent (Score 3)</Label>
            <Textarea id="score3" name="score3" rows={4} />
          </div>
          <div>
            <Label htmlFor="score2">Good (Score 2)</Label>
            <Textarea id="score2" name="score2" rows={4} />
          </div>
          <div>
            <Label htmlFor="score1">Pass (Score 1)</Label>
            <Textarea id="score1" name="score1" rows={4} />
          </div>
          <div>
            <Label htmlFor="score0">Below Pass (Score 0)</Label>
            <Textarea id="score0" name="score0" rows={4} />
          </div>
        </div>

        <div>
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" name="tags" placeholder="safety, measurement" />
        </div>

        <Button type="submit">Save as Draft</Button>
      </form>
    </div>
  );
}
```

### Migration Schema Extension
```sql
-- prisma/migrations/YYYYMMDD_descriptor_batch_workflow/migration.sql

-- Add new enum
CREATE TYPE "DescriptorBatchStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'RETURNED');

-- Add columns to Descriptor
ALTER TABLE "Descriptor" ADD COLUMN "wsosSectionId" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "batchStatus" "DescriptorBatchStatus";
ALTER TABLE "Descriptor" ADD COLUMN "batchId" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Descriptor" ADD COLUMN "reviewerId" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Descriptor" ADD COLUMN "reviewComment" TEXT;

-- Add foreign keys
ALTER TABLE "Descriptor" ADD CONSTRAINT "Descriptor_wsosSectionId_fkey"
  FOREIGN KEY ("wsosSectionId") REFERENCES "WSOSSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Descriptor" ADD CONSTRAINT "Descriptor_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Descriptor" ADD CONSTRAINT "Descriptor_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Descriptor_wsosSectionId_idx" ON "Descriptor"("wsosSectionId");
CREATE INDEX "Descriptor_batchStatus_idx" ON "Descriptor"("batchStatus");
CREATE INDEX "Descriptor_batchId_idx" ON "Descriptor"("batchId");
CREATE INDEX "Descriptor_createdById_idx" ON "Descriptor"("createdById");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate batch table | Status field on entity | Common pattern | Simpler queries, fewer joins |
| Categories array for WSOS | Explicit wsosSection relation | Phase 7 | Type-safe linking, proper FK constraints |
| Single quality field | Quality + batch status | Phase 7 | Clear separation of content quality vs workflow state |
| Global descriptor visibility | Creator-scoped queries | Phase 7 | SCMs only see their own work |

**Deprecated/outdated:**
- **Using categories for WSOS sections:** categories remains for tags; use wsosSection relation for proper linking
- **Admin UI for SCM workflow:** /settings/descriptors is admin-only; SCM workflow at /hub/descriptors/my-descriptors

## Open Questions

1. **Batch Editing During Pending Review**
   - What we know: Once submitted, descriptors should not be editable by SCM
   - What's unclear: Should SCM be able to "withdraw" a pending batch?
   - Recommendation: For Phase 7, no withdrawal; Phase 8 (SA workflow) can handle returns

2. **Batch Grouping Granularity**
   - What we know: batchId groups descriptors submitted together
   - What's unclear: Should SA approve/return entire batch or individual descriptors?
   - Recommendation: Individual descriptor approval (more flexible), but email (Phase 9) summarizes batch

## Sources

### Primary (HIGH confidence)
- Existing Prisma schema: `prisma/schema.prisma` - verified Descriptor model, QualityIndicator enum
- Existing WSOS sections: `src/lib/wsos-sections.ts` - verified getAllWSOSSections, findSimilarWSOSSections
- Existing Server Actions: `src/app/(dashboard)/settings/descriptors/actions.ts` - verified create/update pattern
- Existing auth: `src/lib/auth.ts` - verified requireUser, role checking
- Existing permissions: `src/lib/permissions.ts` - verified SCM-SA via Skill relationship
- Phase 6 summary: confirmed WSOSSection model ready for linking

### Secondary (MEDIUM confidence)
- CreateDescriptorModal pattern: `src/app/(dashboard)/hub/descriptors/review/components/CreateDescriptorModal.tsx`
- WSOSSectionForm pattern: `src/app/(dashboard)/settings/wsos-sections/form.tsx`

### Tertiary (LOW confidence)
None - all patterns verified from codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies in package.json, no new packages needed
- Architecture: HIGH - Patterns verified from existing descriptor/WSOS section code
- Pitfalls: HIGH - Based on codebase review and Phase 6 learnings
- Batch workflow: HIGH - Status-based approach matches existing QualityIndicator pattern

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable patterns, unlikely to change)

## Key Implementation Notes for Planner

1. **Schema changes required:**
   - Add DescriptorBatchStatus enum
   - Add wsosSection relation to Descriptor
   - Add batch tracking fields (batchStatus, batchId, createdById, submittedAt)
   - Add User relations for creator/reviewer
   - Add inverse relation on WSOSSection

2. **New route structure:**
   - `/hub/descriptors/my-descriptors` - SCM descriptor list with batch UI
   - `/hub/descriptors/my-descriptors/create` - Create form with WSOS section select
   - `/hub/descriptors/my-descriptors/[id]/edit` - Edit draft descriptor

3. **Server Actions needed:**
   - createSCMDescriptorAction (with mandatory wsosSectionId)
   - updateSCMDescriptorAction (only DRAFT status)
   - deleteSCMDescriptorAction (only DRAFT status)
   - submitBatchAction (DRAFT -> PENDING_REVIEW)

4. **Reuse from Phase 6:**
   - getAllWSOSSections() for dropdown population
   - checkSimilarSectionsAction() for inline section creation
   - DuplicateWarning component

5. **SCM-SA relationship:** Query Skill where scmId = user.id to get saId for review routing (used in Phase 8/9)

6. **DESC-04 compliance:** All SCM-created descriptors automatically get qualityIndicator = NEEDS_REVIEW
