"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();

  const parsedResult = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Please check your input.";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/change-password?${params.toString()}`);
  }

  const { currentPassword, newPassword } = parsedResult.data;

  // Get the user's current password hash
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!userRecord) {
    const params = new URLSearchParams({ error: "User not found." });
    return redirect(`/change-password?${params.toString()}`);
  }

  // If user has no password (invited user who hasn't set one), allow them to set it
  if (userRecord.passwordHash) {
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userRecord.passwordHash);

    if (!isValidPassword) {
      const params = new URLSearchParams({ error: "Current password is incorrect." });
      return redirect(`/change-password?${params.toString()}`);
    }
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
      },
    });
  } catch (error) {
    console.error("Failed to update password", error);
    const params = new URLSearchParams({ error: "Unable to update password. Please try again." });
    return redirect(`/change-password?${params.toString()}`);
  }

  revalidatePath("/change-password");

  const params = new URLSearchParams({ success: "1" });
  return redirect(`/change-password?${params.toString()}`);
}
