const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyIndexStructure() {
  console.log('=== Verifying GIN Index Structure ===\n');

  // Get index definitions
  const indexes = await prisma.$queryRaw`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'Descriptor'
    AND (indexname LIKE '%fts%' OR indexname LIKE '%tags%')
    ORDER BY indexname
  `;

  console.log('GIN Indexes on Descriptor table:\n');
  indexes.forEach(idx => {
    console.log(`Index: ${idx.indexname}`);
    console.log(`Definition: ${idx.indexdef}`);
    console.log('');
  });

  // Check index sizes
  const indexSizes = await prisma.$queryRaw`
    SELECT
      indexrelname as index_name,
      pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
      idx_scan as times_used,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    AND relname = 'Descriptor'
    AND indexrelname LIKE '%fts%'
    ORDER BY indexrelname
  `;

  console.log('\n=== Index Statistics ===\n');
  indexSizes.forEach(idx => {
    console.log(`Index: ${idx.index_name}`);
    console.log(`  Size: ${idx.index_size}`);
    console.log(`  Times used: ${idx.times_used}`);
    console.log(`  Tuples read: ${idx.tuples_read}`);
    console.log(`  Tuples fetched: ${idx.tuples_fetched}`);
    console.log('');
  });

  // Test a simple query to verify functionality
  console.log('=== Testing Direct Search ===\n');

  const results = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Descriptor"
    WHERE to_tsvector('english', "criterionName") @@ plainto_tsquery('english', 'safety')
  `;

  console.log(`Records matching "safety": ${results[0].count}`);

  await prisma.$disconnect();
}

verifyIndexStructure().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
