"use server";

import { DescriptorBatchStatus, QualityIndicator } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper to parse comma-separated string into array
function parseCommaSeparated(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// Create schema - wsosSectionId is REQUIRED for SCM (DESC-02)
const createSCMDescriptorSchema = z.object({
  code: z.string().min(1, "Code is required"),
  criterionName: z.string().min(5, "Criterion name must be at least 5 characters"),
  wsosSectionId: z.string().min(1, "WSOS section is required"),
  score3: z.string().optional(),
  score2: z.string().optional(),
  score1: z.string().optional(),
  score0: z.string().optional(),
  tags: z.string().optional(),
}).refine(
  (data) => data.score3 || data.score2 || data.score1 || data.score0,
  { message: "At least one performance level description is required" }
);

// Update schema - same as create but with id
const updateSCMDescriptorSchema = z.object({
  id: z.string().min(1, "Descriptor ID is required"),
  code: z.string().min(1, "Code is required"),
  criterionName: z.string().min(5, "Criterion name must be at least 5 characters"),
  wsosSectionId: z.string().min(1, "WSOS section is required"),
  score3: z.string().optional(),
  score2: z.string().optional(),
  score1: z.string().optional(),
  score0: z.string().optional(),
  tags: z.string().optional(),
}).refine(
  (data) => data.score3 || data.score2 || data.score1 || data.score0,
  { message: "At least one performance level description is required" }
);

/**
 * Create a new descriptor as SCM.
 * Automatically sets:
 * - qualityIndicator: NEEDS_REVIEW (DESC-04)
 * - batchStatus: DRAFT (BATCH-01)
 * - source: "SCM"
 * - createdById: current user
 */
export async function createSCMDescriptorAction(formData: FormData) {
  const user = await requireUser();

  // Only SCMs can create through this action
  if (user.role !== "SCM") {
    throw new Error("Only SCMs can create descriptors through this interface");
  }

  const parsed = createSCMDescriptorSchema.safeParse({
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
  const tags = parseCommaSeparated(data.tags);

  try {
    // Use raw SQL to handle text[] array type properly
    await prisma.$executeRaw`
      INSERT INTO "Descriptor" (
        id, code, "criterionName", score3, score2, score1, score0,
        "wsosSectionId", tags, "qualityIndicator", "batchStatus",
        source, "createdById", version, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${data.code.trim()},
        ${data.criterionName.trim()},
        ${data.score3?.trim() || null},
        ${data.score2?.trim() || null},
        ${data.score1?.trim() || null},
        ${data.score0?.trim() || null},
        ${data.wsosSectionId},
        ${tags}::text[],
        ${QualityIndicator.NEEDS_REVIEW}::"QualityIndicator",
        ${DescriptorBatchStatus.DRAFT}::"DescriptorBatchStatus",
        'SCM',
        ${user.id},
        1,
        NOW(),
        NOW()
      )
    `;
  } catch (error) {
    console.error("Failed to create descriptor", error);
    const params = new URLSearchParams({ error: "Failed to create descriptor" });
    return redirect(`/hub/descriptors/my-descriptors/create?${params.toString()}`);
  }

  revalidatePath("/hub/descriptors/my-descriptors");
  const params = new URLSearchParams({ created: "1" });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}

/**
 * Update an SCM's draft descriptor.
 * Only allowed if:
 * - Descriptor exists and is owned by current user (createdById)
 * - Descriptor is in DRAFT status
 */
export async function updateSCMDescriptorAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "SCM") {
    throw new Error("Only SCMs can update descriptors through this interface");
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
    return redirect(`/hub/descriptors/my-descriptors/${id}/edit?${params.toString()}`);
  }

  const data = parsed.data;
  const tags = parseCommaSeparated(data.tags);

  // Verify ownership and DRAFT status
  const existing = await prisma.descriptor.findFirst({
    where: {
      id: data.id,
      createdById: user.id,
      batchStatus: DescriptorBatchStatus.DRAFT,
      deletedAt: null,
    },
  });

  if (!existing) {
    const params = new URLSearchParams({ error: "Descriptor not found or cannot be edited" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

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
        "updatedAt" = NOW()
      WHERE id = ${data.id}
        AND "createdById" = ${user.id}
        AND "batchStatus" = ${DescriptorBatchStatus.DRAFT}::"DescriptorBatchStatus"
    `;
  } catch (error) {
    console.error("Failed to update descriptor", error);
    const params = new URLSearchParams({ error: "Failed to update descriptor" });
    return redirect(`/hub/descriptors/my-descriptors/${data.id}/edit?${params.toString()}`);
  }

  revalidatePath("/hub/descriptors/my-descriptors");
  revalidatePath(`/hub/descriptors/my-descriptors/${data.id}/edit`);
  const params = new URLSearchParams({ updated: "1" });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}

/**
 * Delete (soft-delete) an SCM's draft descriptor.
 * Only allowed if:
 * - Descriptor is owned by current user
 * - Descriptor is in DRAFT status
 */
export async function deleteSCMDescriptorAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "SCM") {
    throw new Error("Only SCMs can delete descriptors through this interface");
  }

  const id = formData.get("id") as string;
  if (!id) {
    const params = new URLSearchParams({ error: "Descriptor ID required" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  // Verify ownership and DRAFT status
  const existing = await prisma.descriptor.findFirst({
    where: {
      id,
      createdById: user.id,
      batchStatus: DescriptorBatchStatus.DRAFT,
      deletedAt: null,
    },
  });

  if (!existing) {
    const params = new URLSearchParams({ error: "Descriptor not found or cannot be deleted" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  try {
    await prisma.descriptor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
      },
    });
  } catch (error) {
    console.error("Failed to delete descriptor", error);
    const params = new URLSearchParams({ error: "Failed to delete descriptor" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  revalidatePath("/hub/descriptors/my-descriptors");
  const params = new URLSearchParams({ deleted: "1" });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}

/**
 * Submit all DRAFT descriptors as a batch for SA review.
 * Updates all DRAFT -> PENDING_REVIEW with:
 * - Same batchId (groups them)
 * - submittedAt timestamp
 *
 * Phase 9 will add email notification to SA here.
 */
export async function submitBatchAction() {
  const user = await requireUser();

  if (user.role !== "SCM") {
    throw new Error("Only SCMs can submit batches");
  }

  // Check if there are any drafts to submit
  const draftCount = await prisma.descriptor.count({
    where: {
      createdById: user.id,
      batchStatus: DescriptorBatchStatus.DRAFT,
      deletedAt: null,
    },
  });

  if (draftCount === 0) {
    const params = new URLSearchParams({ error: "No draft descriptors to submit" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  const batchId = crypto.randomUUID();
  const now = new Date();

  try {
    await prisma.descriptor.updateMany({
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
  } catch (error) {
    console.error("Failed to submit batch", error);
    const params = new URLSearchParams({ error: "Failed to submit batch" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  // TODO: Phase 9 - Send email notification to SA here

  revalidatePath("/hub/descriptors/my-descriptors");
  const params = new URLSearchParams({ submitted: String(draftCount) });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}

/**
 * Update a RETURNED descriptor (SCM revising after SA feedback).
 * Implements APPR-06: SCM can edit and resubmit returned descriptors.
 *
 * Behavior:
 * - Only allowed for RETURNED status descriptors owned by user
 * - Saves edits and changes status back to DRAFT
 * - Clears reviewer fields so SCM can resubmit fresh
 * - SCM must click "Submit for Review" to resend to SA
 */
export async function updateReturnedDescriptorAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== "SCM") {
    throw new Error("Only SCMs can update returned descriptors");
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
    return redirect(`/hub/descriptors/my-descriptors/${id}/edit?${params.toString()}`);
  }

  const data = parsed.data;
  const tags = parseCommaSeparated(data.tags);

  // Verify ownership and RETURNED status (different from DRAFT check)
  const existing = await prisma.descriptor.findFirst({
    where: {
      id: data.id,
      createdById: user.id,
      batchStatus: DescriptorBatchStatus.RETURNED,
      deletedAt: null,
    },
  });

  if (!existing) {
    const params = new URLSearchParams({ error: "Descriptor not found or cannot be edited" });
    return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
  }

  try {
    // Update and change status back to DRAFT for resubmission
    // Clear reviewer fields so SCM can resubmit fresh
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
    return redirect(`/hub/descriptors/my-descriptors/${data.id}/edit?${params.toString()}`);
  }

  revalidatePath("/hub/descriptors/my-descriptors");
  const params = new URLSearchParams({ updated: "1" });
  return redirect(`/hub/descriptors/my-descriptors?${params.toString()}`);
}
