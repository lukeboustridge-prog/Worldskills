const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyIndexes() {
  try {
    const indexes = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'Descriptor'
      AND indexname LIKE '%fts%'
      ORDER BY indexname
    `;

    console.log('FTS Indexes:');
    indexes.forEach(idx => console.log('  -', idx.indexname));

    // Also check tags index
    const tagsIndexes = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'Descriptor'
      AND indexname LIKE '%tags%'
      ORDER BY indexname
    `;

    console.log('\nTags Indexes:');
    tagsIndexes.forEach(idx => console.log('  -', idx.indexname));

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verifyIndexes();
