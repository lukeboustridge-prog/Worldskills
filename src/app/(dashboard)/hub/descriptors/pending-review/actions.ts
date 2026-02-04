"use server";

import { DescriptorBatchStatus, QualityIndicator } from "@prisma/client";
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
 * Implements APPR-02, APPR-03, APPR-04:
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

  // Verify SA can review this descriptor (APPR-01 check)
  const canReview = await canSAReviewDescriptor(user.id, id);
  if (!canReview) {
    return { error: "You do not have permission to review this descriptor" };
  }

  // Fetch current descriptor to compare wording for modification detection
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

  // Detect if any wording was modified (APPR-04)
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

        // Approval fields (APPR-02)
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

const returnDescriptorSchema = z.object({
  id: z.string().min(1, "Descriptor ID required"),
  comment: z.string().min(5, "Please provide a reason (at least 5 characters)"),
});

/**
 * Return a descriptor to SCM with comments.
 * Implements APPR-05:
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
        // Keep qualityIndicator as NEEDS_REVIEW (not GOOD)
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
