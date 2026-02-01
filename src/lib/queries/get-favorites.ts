import { prisma } from "@/lib/prisma";

/**
 * Get all favorited descriptors for a user.
 * Returns descriptors ordered by when they were favorited (most recent first).
 */
export async function getUserFavorites(userId: string) {
  const favorites = await prisma.descriptorFavorite.findMany({
    where: { userId },
    include: {
      descriptor: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter out favorites where descriptor was soft-deleted
  return favorites
    .filter((f) => f.descriptor.deletedAt === null)
    .map((f) => f.descriptor);
}

/**
 * Check if a specific descriptor is favorited by user.
 */
export async function isFavorited(
  userId: string,
  descriptorId: string
): Promise<boolean> {
  const favorite = await prisma.descriptorFavorite.findUnique({
    where: {
      userId_descriptorId: {
        userId,
        descriptorId,
      },
    },
  });
  return favorite !== null;
}

/**
 * Check favorite status for multiple descriptors at once.
 * Returns a Set of descriptor IDs that are favorited.
 */
export async function getFavoriteIds(userId: string): Promise<Set<string>> {
  const favorites = await prisma.descriptorFavorite.findMany({
    where: { userId },
    select: { descriptorId: true },
  });
  return new Set(favorites.map((f) => f.descriptorId));
}
