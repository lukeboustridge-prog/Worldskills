# Phase 8: SA Approval Workflow - Research

**Researched:** 2026-02-04
**Domain:** SA review interface for SCM-submitted descriptors with approve/edit/return actions
**Confidence:** HIGH

## Summary

This phase enables Skill Advisors (SAs) to review descriptors submitted by their SCMs through the batch workflow implemented in Phase 7. The SA can approve descriptors (changing status from PENDING_REVIEW to APPROVED and qualityIndicator to GOOD), edit descriptor wording before approving, or return descriptors to the SCM with comments. A key requirement is tracking whether the SA modified the wording during approval (wasModifiedDuringApproval flag).

The research confirms all required infrastructure exists from Phase 7: the DescriptorBatchStatus enum (DRAFT, PENDING_REVIEW, APPROVED, RETURNED), reviewer fields on Descriptor (reviewerId, reviewedAt, reviewComment), and the SCM-SA relationship via Skill.saId/scmId. The SCM My Descriptors page already renders returned descriptors with SA comments - Phase 8 adds the ability for SCMs to edit and resubmit these.

**Primary recommendation:** Create SA review interface at /hub/descriptors/pending-review (parallel to SCM's /hub/descriptors/my-descriptors), add wasModifiedDuringApproval boolean field to Descriptor schema, implement approve/return Server Actions that update both batchStatus and qualityIndicator, and extend SCM actions to allow editing RETURNED descriptors.

## Standard Stack

All required technologies are already in the project. No new dependencies needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 5.20.0 | ORM with schema extension | Project standard for all models |
| Next.js 14 | 14.2.10 | Server Actions for approval workflow | Project framework |
| PostgreSQL | - | Relational storage with enums | Already has DescriptorBatchStatus enum |
| NextAuth | 4.24.7 | SA role checking | Existing auth infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.23.8 | Form validation | All Server Actions use Zod schemas |
| Radix UI | Various | Dialog for return comment modal | For rejection comment entry |
| date-fns | 3.6.0 | Date formatting | Display submitted/reviewed dates |
| lucide-react | - | Icons | Check, X, Pencil, etc. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| /hub/descriptors/pending-review | /hub/approval | pending-review is more descriptive, parallels my-descriptors |
| Boolean wasModifiedDuringApproval | JSON diff field | Boolean is simpler, meets requirement (flag not history) |
| Individual descriptor actions | Batch approve all | Individual gives more control, SA may want to return specific ones |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma                      # Add wasModifiedDuringApproval field

src/
  app/(dashboard)/
    hub/
      descriptors/
        pending-review/              # NEW: SA approval interface
          page.tsx                   # List pending descriptors from SA's SCMs
          actions.ts                 # SA approval Server Actions
          components/
            PendingReviewCard.tsx    # Expandable card with approve/edit/return
        my-descriptors/
          actions.ts                 # EXTEND: Add editReturnedAction, resubmitAction
          page.tsx                   # EXTEND: Add edit button for RETURNED descriptors
  lib/
    sa-approval.ts                   # NEW: Query utilities for SA approval workflow
```

### Pattern 1: Schema Extension for Modification Tracking
**What:** Add wasModifiedDuringApproval boolean to Descriptor model
**When to use:** APPR-04 requires tracking if SA changed wording before approving
**Example:**
```prisma
// prisma/schema.prisma

model Descriptor {
  // ... existing fields ...

  // Batch workflow fields (from Phase 7)
  batchStatus   DescriptorBatchStatus?
  batchId       String?
  createdById   String?
  createdBy     User?                  @relation("DescriptorCreator", fields: [createdById], references: [id])
  submittedAt   DateTime?
  reviewerId    String?
  reviewer      User?                  @relation("DescriptorReviewer", fields: [reviewerId], references: [id])
  reviewedAt    DateTime?
  reviewComment String?                @db.Text

  // NEW: Modification tracking for Phase 8 (APPR-04)
  wasModifiedDuringApproval Boolean @default(false)

  // ... indexes ...
}
```

### Pattern 2: SA Pending Descriptors Query
**What:** Query descriptors in PENDING_REVIEW status from SCMs assigned to the SA's skills
**When to use:** SA review page needs filtered list by skill relationship
**Example:**
```typescript
// src/lib/sa-approval.ts

import { DescriptorBatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Get pending descriptors for SA to review.
 * Finds all descriptors where:
 * - batchStatus is PENDING_REVIEW
 * - createdById matches an SCM assigned to a skill where the SA is saId
 *
 * This implements APPR-01: SA sees pending descriptors from their skill's SCM
 */
export async function getPendingDescriptorsForSA(saUserId: string) {
  // First, find all SCM user IDs for skills this SA manages
  const skills = await prisma.skill.findMany({
    where: { saId: saUserId },
    select: { scmId: true, name: true },
  });

  const scmIds = skills
    .map((s) => s.scmId)
    .filter((id): id is string => id !== null);

  if (scmIds.length === 0) {
    return [];
  }

  // Then find PENDING_REVIEW descriptors created by those SCMs
  return prisma.descriptor.findMany({
    where: {
      createdById: { in: scmIds },
      batchStatus: DescriptorBatchStatus.PENDING_REVIEW,
      deletedAt: null,
    },
    include: {
      wsosSection: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [
      { submittedAt: "asc" }, // Oldest first (FIFO review)
      { createdAt: "asc" },
    ],
  });
}

export type PendingDescriptor = Awaited<
  ReturnType<typeof getPendingDescriptorsForSA>
>[number];

/**
 * Get counts of pending descriptors grouped by SCM
 * Useful for showing badge counts or summary
 */
export async function getPendingCountsForSA(saUserId: string) {
  const skills = await prisma.skill.findMany({
    where: { saId: saUserId },
    select: { scmId: true, name: true },
  });

  const scmIds = skills
    .map((s) => s.scmId)
    .filter((id): id is string => id !== null);

  if (scmIds.length === 0) {
    return { total: 0, byScm: [] };
  }

  const results = await prisma.descriptor.groupBy({
    by: ["createdById"],
    where: {
      createdById: { in: scmIds },
      batchStatus: DescriptorBatchStatus.PENDING_REVIEW,
      deletedAt: null,
    },
    _count: true,
  });

  const total = results.reduce((sum, r) => sum + r._count, 0);

  return { total, byScm: results };
}

/**
 * Check if SA can review a specific descriptor
 * Returns true if the descriptor was created by an SCM the SA manages
 */
export async function canSAReviewDescriptor(
  saUserId: string,
  descriptorId: string
): Promise<boolean> {
  const descriptor = await prisma.descriptor.findUnique({
    where: { id: descriptorId },
    select: { createdById: true, batchStatus: true },
  });

  if (!descriptor?.createdById) return false;
  if (descriptor.batchStatus !== DescriptorBatchStatus.PENDING_REVIEW)
    return false;

  // Check if SA manages a skill with this SCM
  const skill = await prisma.skill.findFirst({
    where: {
      saId: saUserId,
      scmId: descriptor.createdById,
    },
  });

  return skill !== null;
}
```

### Pattern 3: Approve Action with Modification Detection
**What:** Server Action to approve descriptor, detecting if wording was changed
**When to use:** SA clicks Approve button (with or without prior edits)
**Example:**
```typescript
// src/app/(dashboard)/hub/descriptors/pending-review/actions.ts
"use server";

import {
  DescriptorBatchStatus,
  QualityIndicator,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSAReviewDescriptor } from "@/lib/sa-approval";

const approveDescriptorSchema = z.object({
  id: z.string().min(1, "Descriptor ID required"),
  // Optional edits - if provided, wording was changed
  criterionName: z.string().optional(),
  score3: z.string().optional(),
  score2: z.string().optional(),
  score1: z.string().optional(),
  score0: z.string().optional(),
});

/**
 * Approve a descriptor with optional wording edits.
 * - Changes batchStatus to APPROVED
 * - Changes qualityIndicator to GOOD
 * - Sets reviewerId and reviewedAt
 * - Sets wasModifiedDuringApproval if any wording field changed
 */
export async function approveDescriptorAction(formData: FormData) {
  const user = await requireUser();

  // Only SAs can approve
  if (user.role !== "SA") {
    return { error: "Only Skill Advisors can approve descriptors" };
  }

  const parsed = approveDescriptorSchema.safeParse({
    id: formData.get("id"),
    criterionName: formData.get("criterionName") || undefined,
    score3: formData.get("score3") || undefined,
    score2: formData.get("score2") || undefined,
    score1: formData.get("score1") || undefined,
    score0: formData.get("score0") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { id, criterionName, score3, score2, score1, score0 } = parsed.data;

  // Verify SA can review this descriptor
  const canReview = await canSAReviewDescriptor(user.id, id);
  if (!canReview) {
    return { error: "You do not have permission to review this descriptor" };
  }

  // Fetch current descriptor to compare wording
  const current = await prisma.descriptor.findUnique({
    where: { id },
    select: {
      criterionName: true,
      score3: true,
      score2: true,
      score1: true,
      score0: true,
    },
  });

  if (!current) {
    return { error: "Descriptor not found" };
  }

  // Detect if any wording was modified
  const wasModified =
    (criterionName !== undefined &&
      criterionName.trim() !== current.criterionName) ||
    (score3 !== undefined && score3.trim() !== (current.score3 || "")) ||
    (score2 !== undefined && score2.trim() !== (current.score2 || "")) ||
    (score1 !== undefined && score1.trim() !== (current.score1 || "")) ||
    (score0 !== undefined && score0.trim() !== (current.score0 || ""));

  try {
    await prisma.descriptor.update({
      where: { id },
      data: {
        // Update wording if provided
        ...(criterionName !== undefined && {
          criterionName: criterionName.trim(),
        }),
        ...(score3 !== undefined && { score3: score3.trim() || null }),
        ...(score2 !== undefined && { score2: score2.trim() || null }),
        ...(score1 !== undefined && { score1: score1.trim() || null }),
        ...(score0 !== undefined && { score0: score0.trim() || null }),

        // Approval fields
        batchStatus: DescriptorBatchStatus.APPROVED,
        qualityIndicator: QualityIndicator.GOOD,
        reviewerId: user.id,
        reviewedAt: new Date(),
        wasModifiedDuringApproval: wasModified,

        // Clear any previous return comment
        reviewComment: null,
      },
    });
  } catch (error) {
    console.error("Failed to approve descriptor", error);
    return { error: "Failed to approve descriptor" };
  }

  revalidatePath("/hub/descriptors/pending-review");
  revalidatePath("/hub/descriptors/my-descriptors");

  return { success: true, wasModified };
}
```

### Pattern 4: Return Action with Comment
**What:** Server Action to return descriptor to SCM with rejection comment
**When to use:** SA clicks Return button after entering comment
**Example:**
```typescript
// src/app/(dashboard)/hub/descriptors/pending-review/actions.ts (continued)

const returnDescriptorSchema = z.object({
  id: z.string().min(1, "Descriptor ID required"),
  comment: z.string().min(5, "Please provide a reason (at least 5 characters)"),
});

/**
 * Return a descriptor to SCM with comments.
 * - Changes batchStatus to RETURNED
 * - Keeps qualityIndicator as NEEDS_REVIEW
 * - Sets reviewerId, reviewedAt, and reviewComment
 */
export async function returnDescriptorAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "SA") {
    return { error: "Only Skill Advisors can return descriptors" };
  }

  const parsed = returnDescriptorSchema.safeParse({
    id: formData.get("id"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { id, comment } = parsed.data;

  const canReview = await canSAReviewDescriptor(user.id, id);
  if (!canReview) {
    return { error: "You do not have permission to return this descriptor" };
  }

  try {
    await prisma.descriptor.update({
      where: { id },
      data: {
        batchStatus: DescriptorBatchStatus.RETURNED,
        // Keep qualityIndicator as NEEDS_REVIEW
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewComment: comment.trim(),
      },
    });
  } catch (error) {
    console.error("Failed to return descriptor", error);
    return { error: "Failed to return descriptor" };
  }

  revalidatePath("/hub/descriptors/pending-review");
  revalidatePath("/hub/descriptors/my-descriptors");

  return { success: true };
}
```

### Pattern 5: SCM Edit and Resubmit for Returned Descriptors
**What:** Allow SCM to edit RETURNED descriptors and resubmit for review
**When to use:** APPR-06 - SCM can edit and resubmit returned descriptors
**Example:**
```typescript
// src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts (extended)

/**
 * Update a RETURNED descriptor (SCM revising after SA feedback).
 * Similar to updateSCMDescriptorAction but allows RETURNED status.
 */
export async function editReturnedDescriptorAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "SCM") {
    throw new Error("Only SCMs can edit descriptors");
  }

  const parsed = updateSCMDescriptorSchema.safeParse({
    id: formData.get("id"),
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
    const id = formData.get("id") as string;
    const params = new URLSearchParams({ error });
    return redirect(
      `/hub/descriptors/my-descriptors/${id}/edit?${params.toString()}`
    );
  }

  const data = parsed.data;

  // Verify ownership and RETURNED status (not DRAFT)
  const existing = await prisma.descriptor.findFirst({
    where: {
      id: data.id,
      createdById: user.id,
      batchStatus: DescriptorBatchStatus.RETURNED,
      deletedAt: null,
    },
  });

  if (!existing) {
    const params = new URLSearchParams({
      error: "Descriptor not found or cannot be edited",
    });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  // Update and change status back to DRAFT for resubmission
  // (Or could go directly to PENDING_REVIEW - design decision)
  const tags = parseCommaSeparated(data.tags);

  try {
    await prisma.$executeRaw`
      UPDATE "Descriptor"
      SET
        code = ${data.code.trim()},
        "criterionName" = ${data.criterionName.trim()},
        score3 = ${data.score3?.trim() || null},
        score2 = ${data.score2?.trim() || null},
        score1 = ${data.score1?.trim() || null},
        score0 = ${data.score0?.trim() || null},
        "wsosSectionId" = ${data.wsosSectionId},
        tags = ${tags}::text[],
        "batchStatus" = ${DescriptorBatchStatus.DRAFT}::"DescriptorBatchStatus",
        "reviewComment" = NULL,
        "reviewerId" = NULL,
        "reviewedAt" = NULL,
        "updatedAt" = NOW()
      WHERE id = ${data.id}
    `;
  } catch (error) {
    console.error("Failed to update returned descriptor", error);
    const params = new URLSearchParams({ error: "Failed to update descriptor" });
    return redirect(
      `/hub/descriptors/my-descriptors/${data.id}/edit?${params.toString()}`
    );
  }

  revalidatePath("/hub/descriptors/my-descriptors");
  const params = new URLSearchParams({ updated: "1" });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}
```

### Anti-Patterns to Avoid
- **Global review page showing all descriptors:** SA should only see descriptors from their skill's SCM
- **Approving without updating qualityIndicator:** Must set GOOD when approving (APPR-02)
- **Forgetting wasModifiedDuringApproval flag:** Must track if wording changed (APPR-04)
- **Allowing SCM to edit PENDING_REVIEW:** Only DRAFT and RETURNED are editable
- **Auto-resubmit on save:** SCM should explicitly click "Submit for Review" again

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SCM-SA relationship lookup | Custom query | Skill.saId/scmId via prisma | Already tracks assignment |
| Expandable card with edit mode | Custom component | Pattern from ReviewList.tsx | Already has expand/edit/save flow |
| Quality indicator dropdown | New selector | Pattern from ReviewCard | Already styled with color badges |
| Toast notifications | Alert divs | useToast hook | Consistent UX across app |
| Return comment dialog | Inline form | Radix Dialog | Pattern established in ReviewList |

**Key insight:** The existing `/hub/descriptors/review/components/ReviewList.tsx` has an excellent pattern for expandable cards with inline editing that can be adapted for SA approval.

## Common Pitfalls

### Pitfall 1: Querying All PENDING_REVIEW Descriptors
**What goes wrong:** SA sees descriptors from all SCMs, not just their skill's SCM
**Why it happens:** Simple query without skill relationship filter
**How to avoid:** Always join through Skill to verify SA-SCM relationship
**Warning signs:** SA sees descriptors from SCMs they don't manage

### Pitfall 2: Not Updating qualityIndicator on Approval
**What goes wrong:** Descriptor approved but still shows NEEDS_REVIEW quality
**Why it happens:** Only updating batchStatus, forgetting qualityIndicator
**How to avoid:** Always set qualityIndicator = GOOD when approving
**Warning signs:** Approved descriptors not appearing in library with GOOD status

### Pitfall 3: Modification Detection Logic Errors
**What goes wrong:** wasModifiedDuringApproval flag incorrect (false positives/negatives)
**Why it happens:** String comparison without trimming, null vs empty string issues
**How to avoid:** Trim all values, handle null === "" equivalence
**Warning signs:** Flag set when no changes made, or not set when changes were made

### Pitfall 4: SCM Editing PENDING_REVIEW Descriptors
**What goes wrong:** SCM modifies descriptor while SA is reviewing it
**Why it happens:** Not checking batchStatus before allowing edit
**How to avoid:** Edit actions must verify status is DRAFT or RETURNED
**Warning signs:** Descriptor changes unexpectedly during SA review

### Pitfall 5: Orphaned Return Comments
**What goes wrong:** Old return comment shown on resubmitted descriptor
**Why it happens:** Not clearing reviewComment when SCM resubmits
**How to avoid:** Clear reviewComment, reviewerId, reviewedAt when moving back to DRAFT
**Warning signs:** SA sees old comment on freshly resubmitted descriptor

### Pitfall 6: Missing revalidatePath Calls
**What goes wrong:** UI doesn't update after approval/return actions
**Why it happens:** Forgetting to revalidate both SA and SCM pages
**How to avoid:** Always revalidate both /pending-review and /my-descriptors
**Warning signs:** User needs to refresh to see changes

## Code Examples

Verified patterns from existing codebase:

### SA Review Page
```typescript
// src/app/(dashboard)/hub/descriptors/pending-review/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getPendingDescriptorsForSA, getPendingCountsForSA } from "@/lib/sa-approval";
import { PendingReviewCard } from "./components/PendingReviewCard";

export default async function PendingReviewPage() {
  const user = await requireUser();

  // Only SAs can access this page
  if (user.role !== "SA") {
    redirect("/dashboard");
  }

  const [descriptors, counts] = await Promise.all([
    getPendingDescriptorsForSA(user.id),
    getPendingCountsForSA(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/hub/descriptors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Pending Review
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review descriptors submitted by your SCMs. Approve, edit, or return with feedback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Descriptors Awaiting Review</CardTitle>
          <CardDescription>
            {counts.total} descriptor(s) pending your review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {descriptors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No descriptors pending review.
            </p>
          ) : (
            <div className="space-y-3">
              {descriptors.map((descriptor) => (
                <PendingReviewCard
                  key={descriptor.id}
                  descriptor={descriptor}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Pending Review Card Component
```typescript
// src/app/(dashboard)/hub/descriptors/pending-review/components/PendingReviewCard.tsx
"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Pencil, X, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { approveDescriptorAction, returnDescriptorAction } from "../actions";
import type { PendingDescriptor } from "@/lib/sa-approval";

interface PendingReviewCardProps {
  descriptor: PendingDescriptor;
}

export function PendingReviewCard({ descriptor }: PendingReviewCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [returned, setReturned] = useState(false);

  // Form state for editing
  const [criterionName, setCriterionName] = useState(descriptor.criterionName);
  const [score3, setScore3] = useState(descriptor.score3 || "");
  const [score2, setScore2] = useState(descriptor.score2 || "");
  const [score1, setScore1] = useState(descriptor.score1 || "");
  const [score0, setScore0] = useState(descriptor.score0 || "");

  // Return comment state
  const [returnComment, setReturnComment] = useState("");

  const handleApprove = () => {
    const formData = new FormData();
    formData.set("id", descriptor.id);

    // Include edits if in editing mode
    if (editing) {
      formData.set("criterionName", criterionName);
      formData.set("score3", score3);
      formData.set("score2", score2);
      formData.set("score1", score1);
      formData.set("score0", score0);
    }

    startTransition(async () => {
      const result = await approveDescriptorAction(formData);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        const message = result.wasModified
          ? "Descriptor approved with modifications"
          : "Descriptor approved";
        toast({ title: "Approved", description: message });
        setApproved(true);
      }
    });
  };

  const handleReturn = () => {
    const formData = new FormData();
    formData.set("id", descriptor.id);
    formData.set("comment", returnComment);

    startTransition(async () => {
      const result = await returnDescriptorAction(formData);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Returned", description: "Descriptor returned to SCM with your feedback" });
        setReturned(true);
      }
    });
  };

  const handleCancelEdit = () => {
    setCriterionName(descriptor.criterionName);
    setScore3(descriptor.score3 || "");
    setScore2(descriptor.score2 || "");
    setScore1(descriptor.score1 || "");
    setScore0(descriptor.score0 || "");
    setEditing(false);
  };

  // Don't render if already processed
  if (approved || returned) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground shrink-0 mt-1"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={criterionName}
                onChange={(e) => setCriterionName(e.target.value)}
                className="font-medium"
              />
            ) : (
              <CardTitle className="text-base font-medium leading-tight">
                {descriptor.criterionName}
              </CardTitle>
            )}

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline">{descriptor.code}</Badge>
              {descriptor.wsosSection && (
                <Badge>{descriptor.wsosSection.name}</Badge>
              )}
              {descriptor.createdBy && (
                <>
                  <span>from</span>
                  <span className="font-medium">
                    {descriptor.createdBy.name || descriptor.createdBy.email}
                  </span>
                </>
              )}
              {descriptor.submittedAt && (
                <>
                  <span>submitted</span>
                  <span>{new Date(descriptor.submittedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpanded(true);
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </>
                  )}
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Undo2 className="h-4 w-4 mr-1" />
                      Return
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Return Descriptor</DialogTitle>
                      <DialogDescription>
                        Return this descriptor to the SCM with feedback on what needs to be changed.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="returnComment">Feedback for SCM</Label>
                        <Textarea
                          id="returnComment"
                          value={returnComment}
                          onChange={(e) => setReturnComment(e.target.value)}
                          placeholder="Please explain what needs to be revised..."
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        variant="destructive"
                        onClick={handleReturn}
                        disabled={isPending || returnComment.length < 5}
                      >
                        Return to SCM
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="ml-7 pt-3 border-t space-y-4">
            {editing ? (
              <>
                {/* Score fields for editing */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-green-700">Score 3 (Excellent)</Label>
                    <Textarea
                      value={score3}
                      onChange={(e) => setScore3(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-700">Score 2 (Good)</Label>
                    <Textarea
                      value={score2}
                      onChange={(e) => setScore2(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-yellow-700">Score 1 (Acceptable)</Label>
                    <Textarea
                      value={score1}
                      onChange={(e) => setScore1(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-red-700">Score 0 (Below Standard)</Label>
                    <Textarea
                      value={score0}
                      onChange={(e) => setScore0(e.target.value)}
                      rows={6}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleApprove} disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Approve with Changes
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-sm">
                {descriptor.score3 && (
                  <div>
                    <span className="font-medium text-green-700">Score 3:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score3}</span>
                  </div>
                )}
                {descriptor.score2 && (
                  <div>
                    <span className="font-medium text-blue-700">Score 2:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score2}</span>
                  </div>
                )}
                {descriptor.score1 && (
                  <div>
                    <span className="font-medium text-yellow-700">Score 1:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score1}</span>
                  </div>
                )}
                {descriptor.score0 && (
                  <div>
                    <span className="font-medium text-red-700">Score 0:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score0}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
```

### Migration for wasModifiedDuringApproval
```sql
-- prisma/migrations/YYYYMMDD_add_was_modified_field/migration.sql

-- Add modification tracking field for SA approval workflow
ALTER TABLE "Descriptor" ADD COLUMN "wasModifiedDuringApproval" BOOLEAN NOT NULL DEFAULT false;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single review page for all | Role-specific review pages | Phase 8 | SA sees only their SCM's work |
| Version history for edits | Single modification flag | Design decision | Simpler, meets requirements |
| Batch-level approve/return | Individual descriptor actions | Phase 8 | More granular control |
| Direct status changes | Combined status + quality update | Phase 8 | Ensures GOOD on approval |

**Deprecated/outdated:**
- **Using /hub/descriptors/review for SA workflow:** That page is for admin/general quality review; SA approval goes to /hub/descriptors/pending-review
- **Manual qualityIndicator selection on approve:** Always set to GOOD automatically

## Open Questions

1. **Resubmission Flow**
   - What we know: SCM edits RETURNED descriptor, saves changes
   - What's unclear: Should save automatically resubmit (PENDING_REVIEW) or go to DRAFT first?
   - Recommendation: Go to DRAFT, require explicit "Submit for Review" button click (consistent with initial submission flow)

2. **Batch Approve All**
   - What we know: Individual approve/return per descriptor implemented
   - What's unclear: Should there be a "Approve All" button for efficiency?
   - Recommendation: Start with individual actions; can add batch in future if needed (lower risk of accidental mass approval)

3. **Notification Badge**
   - What we know: Can count pending descriptors for SA
   - What's unclear: Where to show badge count (nav, hub page)?
   - Recommendation: Add badge to /hub navigation item if count > 0 (UX polish, can be Phase 9 with emails)

## Sources

### Primary (HIGH confidence)
- Existing Prisma schema: `prisma/schema.prisma` - verified Descriptor model with batch fields, DescriptorBatchStatus enum
- Existing SCM actions: `src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts` - verified Server Action patterns
- Existing review UI: `src/app/(dashboard)/hub/descriptors/review/components/ReviewList.tsx` - verified expandable card pattern
- Existing auth: `src/lib/auth.ts` - verified requireUser, role checking
- Existing permissions: `src/lib/permissions.ts` - verified SCM-SA relationship via Skill

### Secondary (MEDIUM confidence)
- Skill model: `prisma/schema.prisma:100-125` - SA-SCM relationship via saId/scmId fields
- My Descriptors page: `src/app/(dashboard)/hub/descriptors/my-descriptors/page.tsx` - RETURNED descriptors section pattern

### Tertiary (LOW confidence)
None - all patterns verified from codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies in package.json, no new packages needed
- Architecture: HIGH - Patterns verified from existing review UI and SCM workflow
- Pitfalls: HIGH - Based on codebase review and Phase 7 implementation
- Query patterns: HIGH - SCM-SA relationship verified in Skill model

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable patterns, unlikely to change)

## Key Implementation Notes for Planner

1. **Schema changes required:**
   - Add `wasModifiedDuringApproval Boolean @default(false)` to Descriptor model
   - Run migration to add column

2. **New files needed:**
   - `/hub/descriptors/pending-review/page.tsx` - SA review list
   - `/hub/descriptors/pending-review/actions.ts` - approveDescriptorAction, returnDescriptorAction
   - `/hub/descriptors/pending-review/components/PendingReviewCard.tsx` - expandable card with actions
   - `src/lib/sa-approval.ts` - getPendingDescriptorsForSA, canSAReviewDescriptor

3. **Existing files to modify:**
   - `/hub/descriptors/my-descriptors/page.tsx` - add edit button to RETURNED section
   - `/hub/descriptors/my-descriptors/actions.ts` - add editReturnedDescriptorAction
   - `/hub/descriptors/my-descriptors/[id]/edit/page.tsx` - allow editing RETURNED (not just DRAFT)

4. **Critical flows:**
   - SA opens /pending-review -> sees descriptors from their SCMs only
   - SA clicks Approve -> batchStatus=APPROVED, qualityIndicator=GOOD, wasModified=false
   - SA edits then Approve -> batchStatus=APPROVED, qualityIndicator=GOOD, wasModified=true
   - SA clicks Return with comment -> batchStatus=RETURNED, reviewComment set
   - SCM sees RETURNED descriptor with comment -> edits -> saves -> batchStatus=DRAFT
   - SCM clicks Submit for Review again -> batchStatus=PENDING_REVIEW

5. **Requirements mapping:**
   - APPR-01: getPendingDescriptorsForSA with skill relationship filter
   - APPR-02: approveDescriptorAction sets qualityIndicator=GOOD
   - APPR-03: editing mode in PendingReviewCard before approve
   - APPR-04: wasModifiedDuringApproval flag with diff detection
   - APPR-05: returnDescriptorAction with reviewComment
   - APPR-06: editReturnedDescriptorAction + edit page allows RETURNED status
