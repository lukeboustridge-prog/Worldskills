import { prisma } from "../src/lib/prisma.js";
import { Prisma } from "@prisma/client";

async function explainCombinedQuery() {
  console.log("=== EXPLAIN ANALYZE: Combined Pagination + Facets ===\n");

  const query = "safety";

  // Build the FTS condition
  const ftsCondition = Prisma.sql`
    websearch_to_tsquery('english', ${query}) @@ (
      setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
    ) AND
  `;

  console.log("1. Search Results Query:");
  const searchExplain = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT
      id,
      code,
      "criterionName",
      ts_rank_cd(
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B'),
        websearch_to_tsquery('english', '${query}'),
        32
      ) as rank
    FROM "Descriptor"
    WHERE
      websearch_to_tsquery('english', '${query}') @@ (
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
      )
      AND "deletedAt" IS NULL
    ORDER BY rank DESC
    LIMIT 20
    OFFSET 0
  `);
  console.log(searchExplain);

  console.log("\n2. Count Query:");
  const countExplain = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT COUNT(*)::int as count
    FROM "Descriptor"
    WHERE
      websearch_to_tsquery('english', '${query}') @@ (
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
      )
      AND "deletedAt" IS NULL
  `);
  console.log(countExplain);

  console.log("\n3. Skill Areas Facet Query:");
  const skillFacetExplain = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT "skillName" as name, COUNT(*)::int as count
    FROM "Descriptor"
    WHERE websearch_to_tsquery('english', '${query}') @@ (
      setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
    ) AND "deletedAt" IS NULL
    GROUP BY "skillName"
    ORDER BY count DESC, name ASC
  `);
  console.log(skillFacetExplain);

  console.log("\n4. Categories Facet Query:");
  const categoryFacetExplain = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT category as name, COUNT(*)::int as count
    FROM "Descriptor"
    WHERE websearch_to_tsquery('english', '${query}') @@ (
      setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
    ) AND "deletedAt" IS NULL AND category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC, name ASC
  `);
  console.log(categoryFacetExplain);

  console.log("\n5. Qualities Facet Query:");
  const qualityFacetExplain = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT "qualityIndicator" as name, COUNT(*)::int as count
    FROM "Descriptor"
    WHERE websearch_to_tsquery('english', '${query}') @@ (
      setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
    ) AND "deletedAt" IS NULL
    GROUP BY "qualityIndicator"
    ORDER BY count DESC
  `);
  console.log(qualityFacetExplain);

  await prisma.$disconnect();
}

explainCombinedQuery().catch((err) => {
  console.error("EXPLAIN failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
