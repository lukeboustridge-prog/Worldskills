"use server";

import { QualityIndicator } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateDescriptorSchema = z.object({
  id: z.string().min(1, "Descriptor ID is required"),
  criterionName: z.string().min(3, "Criterion name must be at least 3 characters"),
  score3: z.string().optional(),
  score2: z.string().optional(),
  score1: z.string().optional(),
  score0: z.string().optional(),
  qualityIndicator: z.nativeEnum(QualityIndicator),
});

/**
 * Update a descriptor (available to authenticated users for review)
 */
export async function updateDescriptorReviewAction(formData: FormData) {
  const session = await requireUser();

  // Only allow SA, SCM, Secretariat, and Admin roles
  const allowedRoles = ["SA", "SCM", "Secretariat", "Admin"];
  if (!allowedRoles.includes(session.role)) {
    return { error: "You do not have permission to review descriptors" };
  }

  const parsedResult = updateDescriptorSchema.safeParse({
    id: formData.get("id"),
    criterionName: formData.get("criterionName"),
    score3: formData.get("score3") || undefined,
    score2: formData.get("score2") || undefined,
    score1: formData.get("score1") || undefined,
    score0: formData.get("score0") || undefined,
    qualityIndicator: formData.get("qualityIndicator"),
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Please review the form";
    return { error: firstError };
  }

  const data = parsedResult.data;

  try {
    await prisma.$executeRaw`
      UPDATE "Descriptor"
      SET
        "criterionName" = ${data.criterionName.trim()},
        score3 = ${data.score3?.trim() || null},
        score2 = ${data.score2?.trim() || null},
        score1 = ${data.score1?.trim() || null},
        score0 = ${data.score0?.trim() || null},
        "qualityIndicator" = ${data.qualityIndicator}::"QualityIndicator",
        "updatedAt" = NOW()
      WHERE id = ${data.id}
    `;
  } catch (error) {
    console.error("Failed to update descriptor", error);
    return { error: "Unable to update descriptor" };
  }

  revalidatePath("/hub/descriptors");
  revalidatePath("/hub/descriptors/review");

  return { success: true };
}

/**
 * Quick update just the quality indicator
 */
export async function updateQualityIndicatorAction(id: string, qualityIndicator: QualityIndicator) {
  const session = await requireUser();

  const allowedRoles = ["SA", "SCM", "Secretariat", "Admin"];
  if (!allowedRoles.includes(session.role)) {
    return { error: "You do not have permission to review descriptors" };
  }

  try {
    await prisma.$executeRaw`
      UPDATE "Descriptor"
      SET
        "qualityIndicator" = ${qualityIndicator}::"QualityIndicator",
        "updatedAt" = NOW()
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error("Failed to update quality indicator", error);
    return { error: "Unable to update quality indicator" };
  }

  revalidatePath("/hub/descriptors");
  revalidatePath("/hub/descriptors/review");

  return { success: true };
}
