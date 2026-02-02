import { prisma } from "@/lib/prisma";
import { QualityIndicator } from "@prisma/client";

export interface RelatedDescriptor {
  id: string;
  code: string;
  criterionName: string;
  skillNames: string[];
  sector: string | null;
  categories: string[];
  qualityIndicator: QualityIndicator;
  similarityScore: number;
}

/**
 * Find descriptors with similar criterion names using pg_trgm similarity.
 * Useful for "Related descriptors" recommendations and cross-skill discovery.
 *
 * @param descriptorId - ID of the source descriptor
 * @param limit - Maximum results to return (default 5)
 * @param similarityThreshold - Minimum similarity score 0-1 (default 0.3)
 * @returns Related descriptors ordered by similarity DESC
 */
export async function getRelatedDescriptors(
  descriptorId: string,
  limit: number = 5,
  similarityThreshold: number = 0.3
): Promise<RelatedDescriptor[]> {
  return prisma.$queryRaw<RelatedDescriptor[]>`
    SELECT
      d2.id,
      d2.code,
      d2."criterionName",
      d2."skillNames",
      d2.sector,
      d2.categories,
      d2."qualityIndicator",
      similarity(d1."criterionName", d2."criterionName") as "similarityScore"
    FROM "Descriptor" d1
    CROSS JOIN LATERAL (
      SELECT *
      FROM "Descriptor"
      WHERE id != ${descriptorId}
        AND "deletedAt" IS NULL
        AND similarity("criterionName", d1."criterionName") > ${similarityThreshold}
      ORDER BY similarity("criterionName", d1."criterionName") DESC
      LIMIT ${limit}
    ) d2
    WHERE d1.id = ${descriptorId}
      AND d1."deletedAt" IS NULL
    ORDER BY "similarityScore" DESC
  `;
}

/**
 * Find related descriptors by criterion name text (for use during creation).
 * Useful when descriptor doesn't exist yet but we want to show related items.
 *
 * @param criterionName - The criterion name text to match against
 * @param limit - Maximum results to return (default 5)
 * @param similarityThreshold - Minimum similarity score 0-1 (default 0.3)
 * @param excludeId - Optional ID to exclude (for edit mode)
 */
export async function getRelatedByCriterionName(
  criterionName: string,
  limit: number = 5,
  similarityThreshold: number = 0.3,
  excludeId?: string
): Promise<RelatedDescriptor[]> {
  if (!criterionName || criterionName.length < 5) {
    return [];
  }

  if (excludeId) {
    return prisma.$queryRaw<RelatedDescriptor[]>`
      SELECT
        id,
        code,
        "criterionName",
        "skillNames",
        sector,
        categories,
        "qualityIndicator",
        similarity("criterionName", ${criterionName}) as "similarityScore"
      FROM "Descriptor"
      WHERE "deletedAt" IS NULL
        AND id != ${excludeId}
        AND similarity("criterionName", ${criterionName}) > ${similarityThreshold}
      ORDER BY "similarityScore" DESC
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw<RelatedDescriptor[]>`
    SELECT
      id,
      code,
      "criterionName",
      "skillNames",
      sector,
      categories,
      "qualityIndicator",
      similarity("criterionName", ${criterionName}) as "similarityScore"
    FROM "Descriptor"
    WHERE "deletedAt" IS NULL
      AND similarity("criterionName", ${criterionName}) > ${similarityThreshold}
    ORDER BY "similarityScore" DESC
    LIMIT ${limit}
  `;
}
