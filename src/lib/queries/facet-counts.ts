import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface FacetCount {
  name: string;
  count: number;
}

export interface Facets {
  skillAreas: FacetCount[];
  categories: FacetCount[];
  qualities: FacetCount[];
}

/**
 * Get facet counts for filter panels.
 * When searchQuery is provided, counts reflect matching descriptors only.
 * When empty, counts reflect all non-deleted descriptors.
 */
export async function getFacetCounts(searchQuery?: string): Promise<Facets> {
  // Build the FTS condition if query provided
  const ftsCondition = searchQuery
    ? Prisma.sql`
        websearch_to_tsquery('english', ${searchQuery}) @@ (
          setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
          setweight(to_tsvector('english', coalesce(score3, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(score2, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(score1, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(score0, '')), 'B')
        ) AND
      `
    : Prisma.sql``;

  // Execute all facet queries in parallel
  const [skillAreas, categories, qualities] = await Promise.all([
    prisma.$queryRaw<FacetCount[]>`
      SELECT "skillName" as name, COUNT(*)::int as count
      FROM "Descriptor"
      WHERE ${ftsCondition} "deletedAt" IS NULL
      GROUP BY "skillName"
      ORDER BY count DESC, name ASC
    `,
    prisma.$queryRaw<FacetCount[]>`
      SELECT category as name, COUNT(*)::int as count
      FROM "Descriptor"
      WHERE ${ftsCondition} "deletedAt" IS NULL AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC, name ASC
    `,
    prisma.$queryRaw<FacetCount[]>`
      SELECT "qualityIndicator" as name, COUNT(*)::int as count
      FROM "Descriptor"
      WHERE ${ftsCondition} "deletedAt" IS NULL
      GROUP BY "qualityIndicator"
      ORDER BY count DESC
    `,
  ]);

  return { skillAreas, categories, qualities };
}
