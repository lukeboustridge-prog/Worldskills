"use server";

import { QualityIndicator } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Base Zod schema for descriptor fields (without validation refine)
const baseDescriptorSchema = z.object({
  code: z.string().min(1, "Code is required"),
  criterionName: z.string().min(3, "Criterion name must be at least 3 characters"),
  excellent: z.string().optional(),
  good: z.string().optional(),
  pass: z.string().optional(),
  belowPass: z.string().optional(),
  skillName: z.string().min(1, "Source skill is required"),
  sector: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(), // Comma-separated, parsed below
  qualityIndicator: z.nativeEnum(QualityIndicator).optional(),
});

// Create schema with validation refine for creation
const descriptorSchema = baseDescriptorSchema.refine(
  (data) => data.criterionName.length >= 5 && (data.excellent || data.good || data.pass || data.belowPass),
  { message: "Criterion name must be 5+ characters AND at least one performance level is required" }
);

// Update schema extends base then adds refine
const updateDescriptorSchema = baseDescriptorSchema.extend({
  id: z.string().min(1, "Descriptor ID is required"),
}).refine(
  (data) => data.criterionName.length >= 5 && (data.excellent || data.good || data.pass || data.belowPass),
  { message: "Criterion name must be 5+ characters AND at least one performance level is required" }
);

const deleteDescriptorSchema = z.object({
  id: z.string().min(1, "Descriptor ID is required"),
});

/**
 * Parse comma-separated tags string into array
 */
function parseTags(tagsInput: string | undefined): string[] {
  if (!tagsInput) return [];
  return tagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Create a new descriptor
 */
export async function createDescriptorAction(formData: FormData) {
  await requireAdminUser();

  const parsedResult = descriptorSchema.safeParse({
    code: formData.get("code"),
    criterionName: formData.get("criterionName"),
    excellent: formData.get("excellent") || undefined,
    good: formData.get("good") || undefined,
    pass: formData.get("pass") || undefined,
    belowPass: formData.get("belowPass") || undefined,
    skillName: formData.get("skillName"),
    sector: formData.get("sector") || undefined,
    category: formData.get("category") || undefined,
    tags: formData.get("tags") || undefined,
    qualityIndicator: formData.get("qualityIndicator") || undefined,
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Please review the form";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/descriptors/create?${params.toString()}`);
  }

  const data = parsedResult.data;
  const tags = parseTags(data.tags);

  try {
    await prisma.descriptor.create({
      data: {
        code: data.code.trim(),
        criterionName: data.criterionName.trim(),
        excellent: data.excellent?.trim() || null,
        good: data.good?.trim() || null,
        pass: data.pass?.trim() || null,
        belowPass: data.belowPass?.trim() || null,
        skillName: data.skillName.trim(),
        sector: data.sector?.trim() || null,
        category: data.category?.trim() || null,
        tags,
        qualityIndicator: data.qualityIndicator ?? QualityIndicator.REFERENCE,
        source: "Manual",
        version: 1,
      },
    });
  } catch (error) {
    console.error("Failed to create descriptor", error);
    // Check for unique constraint violation
    if ((error as any)?.code === "P2002") {
      const params = new URLSearchParams({ error: "A descriptor with this code already exists for this skill" });
      return redirect(`/settings/descriptors/create?${params.toString()}`);
    }
    const params = new URLSearchParams({ error: "Unable to create descriptor" });
    return redirect(`/settings/descriptors/create?${params.toString()}`);
  }

  revalidatePath("/settings/descriptors");
  const params = new URLSearchParams({ created: "1" });
  return redirect(`/settings/descriptors?${params.toString()}`);
}

/**
 * Update an existing descriptor
 */
export async function updateDescriptorAction(formData: FormData) {
  await requireAdminUser();

  const parsedResult = updateDescriptorSchema.safeParse({
    id: formData.get("id"),
    code: formData.get("code"),
    criterionName: formData.get("criterionName"),
    excellent: formData.get("excellent") || undefined,
    good: formData.get("good") || undefined,
    pass: formData.get("pass") || undefined,
    belowPass: formData.get("belowPass") || undefined,
    skillName: formData.get("skillName"),
    sector: formData.get("sector") || undefined,
    category: formData.get("category") || undefined,
    tags: formData.get("tags") || undefined,
    qualityIndicator: formData.get("qualityIndicator") || undefined,
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Please review the form";
    const id = formData.get("id") as string;
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/descriptors/${id}/edit?${params.toString()}`);
  }

  const data = parsedResult.data;
  const tags = parseTags(data.tags);

  try {
    await prisma.descriptor.update({
      where: { id: data.id },
      data: {
        code: data.code.trim(),
        criterionName: data.criterionName.trim(),
        excellent: data.excellent?.trim() || null,
        good: data.good?.trim() || null,
        pass: data.pass?.trim() || null,
        belowPass: data.belowPass?.trim() || null,
        skillName: data.skillName.trim(),
        sector: data.sector?.trim() || null,
        category: data.category?.trim() || null,
        tags,
        qualityIndicator: data.qualityIndicator,
      },
    });
  } catch (error) {
    console.error("Failed to update descriptor", error);
    if ((error as any)?.code === "P2002") {
      const params = new URLSearchParams({ error: "A descriptor with this code already exists for this skill" });
      return redirect(`/settings/descriptors/${data.id}/edit?${params.toString()}`);
    }
    const params = new URLSearchParams({ error: "Unable to update descriptor" });
    return redirect(`/settings/descriptors/${data.id}/edit?${params.toString()}`);
  }

  revalidatePath("/settings/descriptors");
  revalidatePath(`/settings/descriptors/${data.id}`);
  const params = new URLSearchParams({ updated: "1" });
  return redirect(`/settings/descriptors?${params.toString()}`);
}

/**
 * Soft-delete a descriptor (sets deletedAt, deletedBy)
 */
export async function deleteDescriptorAction(formData: FormData) {
  const session = await requireAdminUser();

  const parsedResult = deleteDescriptorSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedResult.success) {
    const params = new URLSearchParams({ error: "Unable to delete descriptor" });
    return redirect(`/settings/descriptors?${params.toString()}`);
  }

  const { id } = parsedResult.data;

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
    const params = new URLSearchParams({ error: "Unable to delete descriptor" });
    return redirect(`/settings/descriptors?${params.toString()}`);
  }

  revalidatePath("/settings/descriptors");
  const params = new URLSearchParams({ deleted: "1" });
  return redirect(`/settings/descriptors?${params.toString()}`);
}
