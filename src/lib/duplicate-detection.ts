import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SimilarDescriptor {
  id: string;
  code: string;
  criterionName: string;
  skillNames: string[];
  similarity: number;
}

/**
 * Find descriptors with similar criterion names using pg_trgm trigram similarity.
 * Returns descriptors with similarity > threshold, ordered by similarity DESC.
 *
 * @param criterionName - The criterion name to compare against
 * @param threshold - Minimum similarity score (0-1), default 0.4
 * @param excludeId - Optional ID to exclude (for edit mode)
 * @param limit - Maximum results to return, default 5
 */
export async function findSimilarDescriptors(
  criterionName: string,
  threshold = 0.4,
  excludeId?: string,
  limit = 5
): Promise<SimilarDescriptor[]> {
  if (!criterionName || criterionName.length < 3) {
    return [];
  }

  // Build query using Prisma.sql for proper parameterization
  const baseQuery = Prisma.sql`
    SELECT
      id,
      code,
      "criterionName",
      "skillNames",
      similarity("criterionName", ${criterionName}) as similarity
    FROM "Descriptor"
    WHERE
      similarity("criterionName", ${criterionName}) > ${threshold}
      AND "deletedAt" IS NULL
  `;

  // Conditionally add exclude clause
  const fullQuery = excludeId
    ? Prisma.sql`${baseQuery} AND id != ${excludeId} ORDER BY similarity DESC LIMIT ${limit}`
    : Prisma.sql`${baseQuery} ORDER BY similarity DESC LIMIT ${limit}`;

  const similar = await prisma.$queryRaw<SimilarDescriptor[]>(fullQuery);

  return similar;
}

/**
 * Check if a descriptor with the same code exists within a skill.
 * Used to warn about potential duplicates before create/update.
 * Now checks if any descriptor with the given code has any overlapping skills.
 */
export async function checkCodeExists(
  skillNames: string[],
  code: string,
  excludeId?: string
): Promise<boolean> {
  if (skillNames.length === 0) return false;

  const existing = await prisma.descriptor.findFirst({
    where: {
      skillNames: { hasSome: skillNames },
      code,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  return !!existing;
}
