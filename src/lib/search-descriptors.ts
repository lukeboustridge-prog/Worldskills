import { prisma } from "@/lib/prisma";
import { Prisma, QualityIndicator } from "@prisma/client";

export interface SearchParams {
  query?: string;
  skillName?: string;
  category?: string;
  qualityIndicator?: QualityIndicator;
  limit?: number;
  page?: number;
}

export interface SearchResult {
  id: string;
  code: string;
  criterionName: string;
  score3: string | null;
  score2: string | null;
  score1: string | null;
  score0: string | null;
  skillName: string;
  sector: string | null;
  category: string | null;
  tags: string[];
  qualityIndicator: QualityIndicator;
  rank: number | null;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Search descriptors using PostgreSQL full-text search with relevance ranking.
 *
 * Combines FTS with optional filters (skillName, category, qualityIndicator) using AND.
 * If query is provided, results are ranked by relevance (ts_rank_cd with normalization).
 * If no query, results are ordered by criterionName alphabetically.
 *
 * Uses the functional GIN index idx_descriptors_fts for performance.
 *
 * Returns pagination metadata: total count, current page, hasMore flag.
 */
export async function searchDescriptors(params: SearchParams): Promise<SearchResponse> {
  const {
    query,
    skillName,
    category,
    qualityIndicator,
    limit = 20,
    page = 1
  } = params;

  // Prevent deep pagination performance issues
  const clampedPage = Math.min(Math.max(1, page), 20);
  const offset = (clampedPage - 1) * limit;

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

    // Execute results and count queries in parallel
    const [results, countResult] = await Promise.all([
      prisma.$queryRaw<SearchResult[]>`
        SELECT
          id,
          code,
          "criterionName",
          score3,
          score2,
          score1,
          score0,
          "skillName",
          sector,
          category,
          tags,
          "qualityIndicator",
          ts_rank_cd(
            setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
            setweight(to_tsvector('english', coalesce(score3, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score2, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score1, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score0, '')), 'B'),
            websearch_to_tsquery('english', ${query.trim()}),
            32
          ) as rank
        FROM "Descriptor"
        WHERE
          websearch_to_tsquery('english', ${query.trim()}) @@ (
            setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
            setweight(to_tsvector('english', coalesce(score3, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score2, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score1, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score0, '')), 'B')
          )
          AND "deletedAt" IS NULL
          ${additionalWhere}
        ORDER BY rank DESC
        LIMIT ${limit}::int
        OFFSET ${offset}::int
      `,
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count
        FROM "Descriptor"
        WHERE
          websearch_to_tsquery('english', ${query.trim()}) @@ (
            setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
            setweight(to_tsvector('english', coalesce(score3, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score2, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score1, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(score0, '')), 'B')
          )
          AND "deletedAt" IS NULL
          ${additionalWhere}
      `
    ]);

    const total = countResult[0].count;
    const hasMore = clampedPage * limit < total;

    return {
      results,
      total,
      page: clampedPage,
      limit,
      hasMore
    };
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

    // Execute results and count queries in parallel
    const [results, countResult] = await Promise.all([
      prisma.$queryRaw<SearchResult[]>`
        SELECT
          id,
          code,
          "criterionName",
          score3,
          score2,
          score1,
          score0,
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
      `,
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int as count
        FROM "Descriptor"
        WHERE "deletedAt" IS NULL
          ${additionalWhere}
      `
    ]);

    const total = countResult[0].count;
    const hasMore = clampedPage * limit < total;

    return {
      results,
      total,
      page: clampedPage,
      limit,
      hasMore
    };
  }
}
