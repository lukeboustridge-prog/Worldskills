import { prisma } from "../src/lib/prisma.js";

async function explainQuery() {
  console.log("Running EXPLAIN ANALYZE on search query...\n");

  const result = await prisma.$queryRaw<any[]>`
    EXPLAIN ANALYZE
    SELECT
      id,
      ts_rank_cd(
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B'),
        websearch_to_tsquery('english', 'safety'),
        32
      ) as rank
    FROM "Descriptor"
    WHERE
      websearch_to_tsquery('english', 'safety') @@ (
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
      )
      AND "deletedAt" IS NULL
    ORDER BY rank DESC
    LIMIT 20
  `;

  console.log("EXPLAIN output:");
  result.forEach((row: any) => {
    console.log(row["QUERY PLAN"]);
  });

  await prisma.$disconnect();
}

explainQuery().catch((err) => {
  console.error("EXPLAIN failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
