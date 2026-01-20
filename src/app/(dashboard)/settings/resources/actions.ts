"use server";

import { ResourceCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const resourceSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  url: z.string().url("Provide a valid URL"),
  category: z.nativeEnum(ResourceCategory),
  isFeatured: z.string().optional(),
  position: z.coerce.number().int().min(0).optional(),
});

export async function createResourceLinkAction(formData: FormData) {
  await requireAdminUser();

  const rawIsFeatured = formData.get("isFeatured");
  const parsedResult = resourceSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    url: formData.get("url"),
    category: formData.get("category"),
    isFeatured: rawIsFeatured === null ? undefined : rawIsFeatured,
    position: formData.get("position") || undefined,
  });

  if (!parsedResult.success) {
    const firstError =
      parsedResult.error.errors[0]?.message ?? "Please review the resource details.";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/resources?${params.toString()}`);
  }

  const parsed = parsedResult.data;
  const isFeatured = parsed.isFeatured === "on";

  try {
    await prisma.resourceLink.create({
      data: {
        title: parsed.title.trim(),
        description: parsed.description?.trim() || null,
        url: parsed.url.trim(),
        category: parsed.category,
        isFeatured,
        position: parsed.position ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to create resource", error);
    const params = new URLSearchParams({
      error: "Unable to create the resource. Please try again.",
    });
    return redirect(`/settings/resources?${params.toString()}`);
  }

  revalidatePath("/settings/resources");
  revalidatePath("/hub/kb");
  revalidatePath("/hub");

  const params = new URLSearchParams({ created: "1" });
  return redirect(`/settings/resources?${params.toString()}`);
}

const updateResourceSchema = z.object({
  id: z.string().min(1, "Resource ID is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  url: z.string().url("Provide a valid URL"),
  category: z.nativeEnum(ResourceCategory),
  isFeatured: z.string().optional(),
  position: z.coerce.number().int().min(0).optional(),
});

export async function updateResourceLinkAction(formData: FormData) {
  await requireAdminUser();

  const rawIsFeatured = formData.get("isFeatured");
  const parsedResult = updateResourceSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    url: formData.get("url"),
    category: formData.get("category"),
    isFeatured: rawIsFeatured === null ? undefined : rawIsFeatured,
    position: formData.get("position") || undefined,
  });

  if (!parsedResult.success) {
    const firstError =
      parsedResult.error.errors[0]?.message ?? "Please review the resource details.";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/resources?${params.toString()}`);
  }

  const parsed = parsedResult.data;
  const isFeatured = parsed.isFeatured === "on";

  try {
    await prisma.resourceLink.update({
      where: { id: parsed.id },
      data: {
        title: parsed.title.trim(),
        description: parsed.description?.trim() || null,
        url: parsed.url.trim(),
        category: parsed.category,
        isFeatured,
        position: parsed.position ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to update resource", error);
    const params = new URLSearchParams({
      error: "Unable to update the resource. Please try again.",
    });
    return redirect(`/settings/resources?${params.toString()}`);
  }

  revalidatePath("/settings/resources");
  revalidatePath("/hub/kb");
  revalidatePath("/hub");

  const params = new URLSearchParams({ updated: "1" });
  return redirect(`/settings/resources?${params.toString()}`);
}

const deleteResourceSchema = z.object({
  id: z.string().min(1, "Resource ID is required"),
});

export async function deleteResourceLinkAction(formData: FormData) {
  await requireAdminUser();

  const parsedResult = deleteResourceSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedResult.success) {
    const firstError =
      parsedResult.error.errors[0]?.message ?? "Unable to delete the resource.";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/resources?${params.toString()}`);
  }

  const { id } = parsedResult.data;

  try {
    await prisma.resourceLink.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Failed to delete resource", error);
    const params = new URLSearchParams({
      error: "Unable to delete the resource. Please try again.",
    });
    return redirect(`/settings/resources?${params.toString()}`);
  }

  revalidatePath("/settings/resources");
  revalidatePath("/hub/kb");
  revalidatePath("/hub");

  const params = new URLSearchParams({ deleted: "1" });
  return redirect(`/settings/resources?${params.toString()}`);
}
