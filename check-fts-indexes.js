const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIndexes() {
  const indexes = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'Descriptor'
    AND indexname LIKE '%fts%'
    ORDER BY indexname;
  `;

  console.log('=== FTS Indexes on Descriptor Table ===\n');
  if (indexes.length === 0) {
    console.log('⚠ No FTS indexes found!');
  } else {
    indexes.forEach(idx => {
      console.log(`✓ ${idx.indexname}`);
    });
  }

  console.log(`\nTotal FTS indexes: ${indexes.length}`);
  console.log('Expected: descriptor_criterion_fts_idx, descriptor_all_fts_idx');

  await prisma.$disconnect();
}

checkIndexes();
