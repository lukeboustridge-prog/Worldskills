const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIndexUsage() {
  console.log('=== Checking Index Usage ===\n');

  const explain = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, "criterionName", "skillName",
      ts_rank(
        to_tsvector('english', "criterionName"),
        plainto_tsquery('english', 'safety')
      ) as rank
    FROM "Descriptor"
    WHERE to_tsvector('english', "criterionName") @@ plainto_tsquery('english', 'safety')
    ORDER BY rank DESC
    LIMIT 10;
  `);

  explain.forEach(row => {
    console.log(row['QUERY PLAN']);
  });

  await prisma.$disconnect();
}

checkIndexUsage();
