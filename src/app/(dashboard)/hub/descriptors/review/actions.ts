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
  skillNames: z.array(z.string()).min(1, "At least one skill is required"),
  categories: z.array(z.string()).optional(),
});

const createDescriptorSchema = z.object({
  code: z.string().min(1, "Code is required"),
  criterionName: z.string().min(3, "Criterion name must be at least 3 characters"),
  score3: z.string().optional(),
  score2: z.string().optional(),
  score1: z.string().optional(),
  score0: z.string().optional(),
  skillNames: z.array(z.string()).min(1, "At least one skill is required"),
  categories: z.array(z.string()).optional(),
  qualityIndicator: z.nativeEnum(QualityIndicator).optional(),
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

  // Parse arrays from form data (sent as JSON strings)
  let skillNames: string[] = [];
  let categories: string[] = [];

  try {
    const skillNamesRaw = formData.get("skillNames");
    if (skillNamesRaw) {
      skillNames = JSON.parse(skillNamesRaw as string);
    }
    const categoriesRaw = formData.get("categories");
    if (categoriesRaw) {
      categories = JSON.parse(categoriesRaw as string);
    }
  } catch {
    return { error: "Invalid skill or category data" };
  }

  const parsedResult = updateDescriptorSchema.safeParse({
    id: formData.get("id"),
    criterionName: formData.get("criterionName"),
    score3: formData.get("score3") || undefined,
    score2: formData.get("score2") || undefined,
    score1: formData.get("score1") || undefined,
    score0: formData.get("score0") || undefined,
    qualityIndicator: formData.get("qualityIndicator"),
    skillNames,
    categories: categories.length > 0 ? categories : undefined,
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Please review the form";
    return { error: firstError };
  }

  const data = parsedResult.data;

  try {
    await prisma.descriptor.update({
      where: { id: data.id },
      data: {
        criterionName: data.criterionName.trim(),
        score3: data.score3?.trim() || null,
        score2: data.score2?.trim() || null,
        score1: data.score1?.trim() || null,
        score0: data.score0?.trim() || null,
        qualityIndicator: data.qualityIndicator,
        skillNames: data.skillNames.map(s => s.trim()),
        categories: data.categories?.map(c => c.trim()) || [],
      },
    });
  } catch (error) {
    console.error("Failed to update descriptor", error);
    return { error: "Unable to update descriptor" };
  }

  revalidatePath("/hub/descriptors");
  revalidatePath("/hub/descriptors/review");

  return { success: true };
}

/**
 * Create a new descriptor
 */
export async function createDescriptorAction(formData: FormData) {
  const session = await requireUser();

  const allowedRoles = ["SA", "SCM", "Secretariat", "Admin"];
  if (!allowedRoles.includes(session.role)) {
    return { error: "You do not have permission to create descriptors" };
  }

  // Parse arrays from form data (sent as JSON strings)
  let skillNames: string[] = [];
  let categories: string[] = [];

  try {
    const skillNamesRaw = formData.get("skillNames");
    if (skillNamesRaw) {
      skillNames = JSON.parse(skillNamesRaw as string);
    }
    const categoriesRaw = formData.get("categories");
    if (categoriesRaw) {
      categories = JSON.parse(categoriesRaw as string);
    }
  } catch {
    return { error: "Invalid skill or category data" };
  }

  const parsedResult = createDescriptorSchema.safeParse({
    code: formData.get("code"),
    criterionName: formData.get("criterionName"),
    score3: formData.get("score3") || undefined,
    score2: formData.get("score2") || undefined,
    score1: formData.get("score1") || undefined,
    score0: formData.get("score0") || undefined,
    skillNames,
    categories: categories.length > 0 ? categories : undefined,
    qualityIndicator: formData.get("qualityIndicator") || undefined,
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Please review the form";
    return { error: firstError };
  }

  const data = parsedResult.data;

  try {
    await prisma.descriptor.create({
      data: {
        code: data.code.trim(),
        criterionName: data.criterionName.trim(),
        score3: data.score3?.trim() || null,
        score2: data.score2?.trim() || null,
        score1: data.score1?.trim() || null,
        score0: data.score0?.trim() || null,
        skillNames: data.skillNames.map(s => s.trim()),
        categories: data.categories?.map(c => c.trim()) || [],
        source: "Manual",
        qualityIndicator: data.qualityIndicator || "NEEDS_REVIEW",
      },
    });
  } catch (error: unknown) {
    console.error("Failed to create descriptor", error);
    return { error: "Unable to create descriptor" };
  }

  revalidatePath("/hub/descriptors");
  revalidatePath("/hub/descriptors/review");

  return { success: true };
}

/**
 * Soft delete a descriptor
 */
export async function deleteDescriptorAction(id: string) {
  const session = await requireUser();

  const allowedRoles = ["SA", "SCM", "Secretariat", "Admin"];
  if (!allowedRoles.includes(session.role)) {
    return { error: "You do not have permission to delete descriptors" };
  }

  try {
    await prisma.descriptor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.id,
      },
    });
  } catch (error) {
    console.error("Failed to delete descriptor", error);
    return { error: "Unable to delete descriptor" };
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
