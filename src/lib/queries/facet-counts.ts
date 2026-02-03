import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface FacetCount {
  name: string;
  count: number;
}

export interface Facets {
  categories: FacetCount[];
  qualities: FacetCount[];
}

/**
 * Get facet counts for filter panels.
 * When searchQuery is provided, counts reflect matching descriptors only.
 * When empty, counts reflect all non-deleted descriptors.
 *
 * Uses unnest() to expand array columns for proper counting.
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
  // Use unnest() to expand arrays for counting
  const [categories, qualities] = await Promise.all([
    prisma.$queryRaw<FacetCount[]>`
      SELECT cat as name, COUNT(DISTINCT d.id)::int as count
      FROM "Descriptor" d, unnest(d."categories") as cat
      WHERE ${ftsCondition} d."deletedAt" IS NULL
      GROUP BY cat
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

  return { categories, qualities };
}
