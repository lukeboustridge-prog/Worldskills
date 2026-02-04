"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findSimilarWSOSSections, SimilarSection } from "@/lib/wsos-sections";

const createWSOSSectionSchema = z.object({
  name: z.string().min(3, "Section name must be at least 3 characters"),
  description: z.string().optional(),
});

export async function createWSOSSectionAction(formData: FormData) {
  const user = await requireUser();

  // Role check: SCM or Admin only
  if (user.role !== "SCM" && !user.isAdmin) {
    throw new Error("Only SCMs can create WSOS sections");
  }

  const parsedResult = createWSOSSectionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsedResult.success) {
    const firstError =
      parsedResult.error.errors[0]?.message ?? "Please review the section details.";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }

  const parsed = parsedResult.data;

  try {
    await prisma.wSOSSection.create({
      data: {
        name: parsed.name.trim(),
        description: parsed.description?.trim() || null,
        createdBy: user.id,
      },
    });
  } catch (error) {
    // Handle unique constraint violation (P2002)
    if ((error as { code?: string })?.code === "P2002") {
      const params = new URLSearchParams({
        error: "A section with this name already exists",
      });
      return redirect(`/settings/wsos-sections?${params.toString()}`);
    }
    console.error("Failed to create WSOS section", error);
    const params = new URLSearchParams({
      error: "Unable to create the section. Please try again.",
    });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }

  revalidatePath("/settings/wsos-sections");

  const params = new URLSearchParams({ created: "1" });
  return redirect(`/settings/wsos-sections?${params.toString()}`);
}

const updateWSOSSectionSchema = z.object({
  id: z.string().min(1, "Section ID is required"),
  name: z.string().min(3, "Section name must be at least 3 characters"),
  description: z.string().optional(),
});

export async function updateWSOSSectionAction(formData: FormData) {
  const user = await requireUser();

  // Role check: SCM or Admin only
  if (user.role !== "SCM" && !user.isAdmin) {
    throw new Error("Only SCMs can update WSOS sections");
  }

  const parsedResult = updateWSOSSectionSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsedResult.success) {
    const firstError =
      parsedResult.error.errors[0]?.message ?? "Please review the section details.";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }

  const parsed = parsedResult.data;

  try {
    await prisma.wSOSSection.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name.trim(),
        description: parsed.description?.trim() || null,
      },
    });
  } catch (error) {
    // Handle unique constraint violation (P2002)
    if ((error as { code?: string })?.code === "P2002") {
      const params = new URLSearchParams({
        error: "A section with this name already exists",
      });
      return redirect(`/settings/wsos-sections?${params.toString()}`);
    }
    console.error("Failed to update WSOS section", error);
    const params = new URLSearchParams({
      error: "Unable to update the section. Please try again.",
    });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }

  revalidatePath("/settings/wsos-sections");

  const params = new URLSearchParams({ updated: "1" });
  return redirect(`/settings/wsos-sections?${params.toString()}`);
}

const deleteWSOSSectionSchema = z.object({
  id: z.string().min(1, "Section ID is required"),
});

export async function deleteWSOSSectionAction(formData: FormData) {
  const user = await requireUser();

  // Role check: SCM or Admin only
  if (user.role !== "SCM" && !user.isAdmin) {
    throw new Error("Only SCMs can delete WSOS sections");
  }

  const parsedResult = deleteWSOSSectionSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedResult.success) {
    const firstError =
      parsedResult.error.errors[0]?.message ?? "Unable to delete the section.";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }

  const { id } = parsedResult.data;

  try {
    await prisma.wSOSSection.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Failed to delete WSOS section", error);
    const params = new URLSearchParams({
      error: "Unable to delete the section. Please try again.",
    });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }

  revalidatePath("/settings/wsos-sections");

  const params = new URLSearchParams({ deleted: "1" });
  return redirect(`/settings/wsos-sections?${params.toString()}`);
}

/**
 * Check for similar WSOS sections based on name.
 * This is a callable Server Action for client-side duplicate warning.
 *
 * @param name - The section name to check for duplicates
 * @param excludeId - Optional ID to exclude (for edit mode)
 * @returns Array of similar sections with similarity scores
 */
export async function checkSimilarSectionsAction(
  name: string,
  excludeId?: string
): Promise<SimilarSection[]> {
  // No auth check needed - just a read operation
  // The form submission will check permissions

  return findSimilarWSOSSections(name, 0.3, excludeId);
}
