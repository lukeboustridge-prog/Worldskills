"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminOrSecretariat } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSessionSchema = z.object({
  name: z.string().min(3, "Session name must be at least 3 characters"),
});

export async function createSessionAction(formData: FormData) {
  const user = await requireAdminOrSecretariat();

  const parsed = createSessionSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message };
  }

  // Deactivate any existing active sessions
  await prisma.cPWSession.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  // Create new session
  try {
    await prisma.cPWSession.create({
      data: {
        name: parsed.data.name.trim(),
        createdBy: user.id,
        isActive: true,
        isLocked: false,
      },
    });
  } catch (error) {
    console.error("Failed to create session", error);
    return { error: "Failed to create session" };
  }

  revalidatePath("/cpw/admin");
  revalidatePath("/cpw/vote");
  revalidatePath("/cpw/display");

  return { success: true };
}

export async function lockSessionAction(formData: FormData) {
  await requireAdminOrSecretariat();

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) {
    return { error: "Session ID required" };
  }

  try {
    await prisma.cPWSession.update({
      where: { id: sessionId },
      data: {
        isLocked: true,
        lockedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Failed to lock session", error);
    return { error: "Failed to lock session" };
  }

  revalidatePath("/cpw/admin");
  revalidatePath("/cpw/vote");
  revalidatePath("/cpw/display");

  return { success: true };
}

export async function unlockSessionAction(formData: FormData) {
  await requireAdminOrSecretariat();

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) {
    return { error: "Session ID required" };
  }

  try {
    await prisma.cPWSession.update({
      where: { id: sessionId },
      data: {
        isLocked: false,
        lockedAt: null,
      },
    });
  } catch (error) {
    console.error("Failed to unlock session", error);
    return { error: "Failed to unlock session" };
  }

  revalidatePath("/cpw/admin");
  revalidatePath("/cpw/vote");
  revalidatePath("/cpw/display");

  return { success: true };
}

export async function endSessionAction(formData: FormData) {
  await requireAdminOrSecretariat();

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) {
    return { error: "Session ID required" };
  }

  try {
    await prisma.cPWSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        isLocked: true,
        lockedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Failed to end session", error);
    return { error: "Failed to end session" };
  }

  revalidatePath("/cpw/admin");
  revalidatePath("/cpw/vote");
  revalidatePath("/cpw/display");

  return { success: true };
}

export async function resetVotesAction(formData: FormData) {
  await requireAdminOrSecretariat();

  const sessionId = formData.get("sessionId") as string;
  if (!sessionId) {
    return { error: "Session ID required" };
  }

  try {
    await prisma.cPWVote.deleteMany({
      where: { sessionId },
    });

    // Also unlock the session
    await prisma.cPWSession.update({
      where: { id: sessionId },
      data: {
        isLocked: false,
        lockedAt: null,
      },
    });
  } catch (error) {
    console.error("Failed to reset votes", error);
    return { error: "Failed to reset votes" };
  }

  revalidatePath("/cpw/admin");
  revalidatePath("/cpw/vote");
  revalidatePath("/cpw/display");

  return { success: true };
}
