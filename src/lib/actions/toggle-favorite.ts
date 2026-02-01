"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function toggleFavorite(descriptorId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;

  // Check if already favorited
  const existing = await prisma.descriptorFavorite.findUnique({
    where: {
      userId_descriptorId: {
        userId,
        descriptorId,
      },
    },
  });

  if (existing) {
    // Remove favorite
    await prisma.descriptorFavorite.delete({
      where: {
        userId_descriptorId: {
          userId,
          descriptorId,
        },
      },
    });
  } else {
    // Add favorite
    await prisma.descriptorFavorite.create({
      data: {
        userId,
        descriptorId,
      },
    });
  }

  revalidatePath("/descriptors");
  return { success: true, isFavorited: !existing };
}
