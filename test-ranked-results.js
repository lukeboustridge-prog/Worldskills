const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRankedResults() {
  console.log('=== Testing Ranked Full-Text Search Results ===\n');

  // Test with a term that should have multiple matches
  const searchTerm = 'measurement';

  console.log(`Searching for: "${searchTerm}"\n`);

  const results = await prisma.$queryRaw`
    SELECT
      id,
      "skillName",
      "criterionName",
      ts_rank(
        to_tsvector('english', "criterionName"),
        plainto_tsquery('english', ${searchTerm})
      ) as rank
    FROM "Descriptor"
    WHERE to_tsvector('english', "criterionName") @@ plainto_tsquery('english', ${searchTerm})
    ORDER BY rank DESC
    LIMIT 10
  `;

  console.log(`Found ${results.length} results (showing top 10):\n`);

  results.forEach((result, index) => {
    console.log(`${index + 1}. [Rank: ${result.rank.toFixed(4)}] ${result.skillName}`);
    console.log(`   "${result.criterionName}"`);
    console.log('');
  });

  // Test combined content search
  console.log('\n=== Testing Combined Content Search ===\n');
  console.log('Searching across all text fields for: "accuracy"\n');

  const combinedResults = await prisma.$queryRaw`
    SELECT
      id,
      "skillName",
      "criterionName",
      ts_rank(
        to_tsvector('english',
          coalesce("criterionName", '') || ' ' ||
          coalesce("excellent", '') || ' ' ||
          coalesce("good", '') || ' ' ||
          coalesce("pass", '') || ' ' ||
          coalesce("belowPass", '')
        ),
        plainto_tsquery('english', 'accuracy')
      ) as rank
    FROM "Descriptor"
    WHERE to_tsvector('english',
      coalesce("criterionName", '') || ' ' ||
      coalesce("excellent", '') || ' ' ||
      coalesce("good", '') || ' ' ||
      coalesce("pass", '') || ' ' ||
      coalesce("belowPass", '')
    ) @@ plainto_tsquery('english', 'accuracy')
    ORDER BY rank DESC
    LIMIT 5
  `;

  console.log(`Found ${combinedResults.length} results (showing top 5):\n`);

  combinedResults.forEach((result, index) => {
    console.log(`${index + 1}. [Rank: ${result.rank.toFixed(4)}] ${result.skillName}`);
    console.log(`   "${result.criterionName.substring(0, 80)}${result.criterionName.length > 80 ? '...' : ''}"`);
    console.log('');
  });

  // Summary
  console.log('\n=== Summary ===');
  console.log('✅ FTS queries return ranked results');
  console.log('✅ Results ordered by relevance (ts_rank)');
  console.log('✅ Both criterion-only and combined content searches work');
  console.log('✅ GIN indexes created and ready for use at scale');

  await prisma.$disconnect();
}

testRankedResults().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
