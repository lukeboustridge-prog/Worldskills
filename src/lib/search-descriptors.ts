import { prisma } from "@/lib/prisma";
import { Prisma, QualityIndicator } from "@prisma/client";

export interface SearchParams {
  query?: string;
  skillName?: string;
  category?: string;
  qualityIndicator?: QualityIndicator;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  code: string;
  criterionName: string;
  excellent: string | null;
  good: string | null;
  pass: string | null;
  belowPass: string | null;
  skillName: string;
  sector: string | null;
  category: string | null;
  tags: string[];
  qualityIndicator: QualityIndicator;
  rank: number | null;
}

/**
 * Search descriptors using PostgreSQL full-text search with relevance ranking.
 *
 * Combines FTS with optional filters (skillName, category, qualityIndicator) using AND.
 * If query is provided, results are ranked by relevance (ts_rank_cd with normalization).
 * If no query, results are ordered by criterionName alphabetically.
 *
 * Uses the functional GIN index idx_descriptors_fts for performance.
 */
export async function searchDescriptors(params: SearchParams): Promise<SearchResult[]> {
  const {
    query,
    skillName,
    category,
    qualityIndicator,
    limit = 20,
    offset = 0
  } = params;

  // If query provided, use FTS with ranking
  if (query && query.trim()) {
    // Build WHERE clauses conditionally
    let additionalWhere = Prisma.sql``;

    if (skillName) {
      additionalWhere = Prisma.sql`${additionalWhere} AND "skillName" = ${skillName}`;
    }

    if (category) {
      additionalWhere = Prisma.sql`${additionalWhere} AND "category" = ${category}`;
    }

    if (qualityIndicator) {
      additionalWhere = Prisma.sql`${additionalWhere} AND "qualityIndicator" = ${qualityIndicator}`;
    }

    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT
        id,
        code,
        "criterionName",
        excellent,
        good,
        pass,
        "belowPass",
        "skillName",
        sector,
        category,
        tags,
        "qualityIndicator",
        ts_rank_cd(
          setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("belowPass", '')), 'B'),
          websearch_to_tsquery('english', ${query.trim()}),
          32
        ) as rank
      FROM "Descriptor"
      WHERE
        websearch_to_tsquery('english', ${query.trim()}) @@ (
          setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
        )
        AND "deletedAt" IS NULL
        ${additionalWhere}
      ORDER BY rank DESC
      LIMIT ${limit}::int
      OFFSET ${offset}::int
    `;

    return results;
  } else {
    // No query - browse mode with filters
    let additionalWhere = Prisma.sql``;

    if (skillName) {
      additionalWhere = Prisma.sql`${additionalWhere} AND "skillName" = ${skillName}`;
    }

    if (category) {
      additionalWhere = Prisma.sql`${additionalWhere} AND "category" = ${category}`;
    }

    if (qualityIndicator) {
      additionalWhere = Prisma.sql`${additionalWhere} AND "qualityIndicator" = ${qualityIndicator}`;
    }

    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT
        id,
        code,
        "criterionName",
        excellent,
        good,
        pass,
        "belowPass",
        "skillName",
        sector,
        category,
        tags,
        "qualityIndicator",
        NULL as rank
      FROM "Descriptor"
      WHERE "deletedAt" IS NULL
        ${additionalWhere}
      ORDER BY "criterionName" ASC
      LIMIT ${limit}::int
      OFFSET ${offset}::int
    `;

    return results;
  }
}
