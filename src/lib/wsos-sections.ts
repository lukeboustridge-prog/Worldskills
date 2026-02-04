import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SimilarSection {
  id: string;
  name: string;
  similarity: number;
}

/**
 * Get all WSOS sections ordered by name ascending with creator info.
 */
export async function getAllWSOSSections() {
  return prisma.wSOSSection.findMany({
    orderBy: { name: "asc" },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export type WSOSSectionWithCreator = Awaited<
  ReturnType<typeof getAllWSOSSections>
>[number];

/**
 * Find WSOS sections with similar names using pg_trgm trigram similarity.
 * Returns sections with similarity > threshold, ordered by similarity DESC.
 *
 * @param name - The section name to compare against
 * @param threshold - Minimum similarity score (0-1), default 0.3 (lower than descriptors because section names are shorter)
 * @param excludeId - Optional ID to exclude (for edit mode)
 * @param limit - Maximum results to return, default 5
 */
export async function findSimilarWSOSSections(
  name: string,
  threshold = 0.3,
  excludeId?: string,
  limit = 5
): Promise<SimilarSection[]> {
  if (!name || name.length < 3) {
    return [];
  }

  // Build query using Prisma.sql for proper parameterization
  const baseQuery = Prisma.sql`
    SELECT
      id,
      name,
      similarity(name, ${name}) as similarity
    FROM "WSOSSection"
    WHERE
      similarity(name, ${name}) > ${threshold}
  `;

  // Conditionally add exclude clause
  const fullQuery = excludeId
    ? Prisma.sql`${baseQuery} AND id != ${excludeId} ORDER BY similarity DESC LIMIT ${limit}`
    : Prisma.sql`${baseQuery} ORDER BY similarity DESC LIMIT ${limit}`;

  const similar = await prisma.$queryRaw<SimilarSection[]>(fullQuery);

  return similar;
}

/**
 * Get a single WSOS section by ID.
 *
 * @param id - The section ID to find
 * @returns The section or null if not found
 */
export async function getWSOSSectionById(id: string) {
  return prisma.wSOSSection.findUnique({
    where: { id },
  });
}
