const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEST_TERMS = ['safety', 'welding', 'quality', 'measurement', 'teamwork'];

async function testSearch(term) {
  const start = Date.now();

  const results = await prisma.$queryRaw`
    SELECT id, "criterionName", "skillName",
      ts_rank(
        to_tsvector('english', "criterionName"),
        plainto_tsquery('english', ${term})
      ) as rank
    FROM "Descriptor"
    WHERE to_tsvector('english', "criterionName") @@ plainto_tsquery('english', ${term})
    ORDER BY rank DESC
    LIMIT 10;
  `;

  const duration = Date.now() - start;

  return { term, results, duration, count: results.length };
}

async function runTests() {
  console.log('=== Full-Text Search Performance Tests ===\n');

  const allResults = [];

  for (const term of TEST_TERMS) {
    const result = await testSearch(term);
    allResults.push(result);

    console.log(`\n🔍 Search: "${term}"`);
    console.log(`⏱  Duration: ${result.duration}ms`);
    console.log(`📊 Results: ${result.count} matches`);

    if (result.count > 0) {
      console.log('\nTop 3 results:');
      result.results.slice(0, 3).forEach((r, i) => {
        const rankScore = parseFloat(r.rank).toFixed(4);
        const skillName = r.skillName.substring(0, 30);
        const criterion = r.criterionName.substring(0, 50);
        console.log(`  ${i + 1}. [${rankScore}] ${skillName} - ${criterion}...`);
      });
    }
  }

  console.log('\n\n=== Performance Summary ===\n');

  const avgDuration = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;
  const maxDuration = Math.max(...allResults.map(r => r.duration));
  const minDuration = Math.min(...allResults.map(r => r.duration));

  console.log(`Average query time: ${avgDuration.toFixed(1)}ms`);
  console.log(`Fastest query: ${minDuration}ms`);
  console.log(`Slowest query: ${maxDuration}ms`);
  console.log(`Target: <100ms`);

  if (avgDuration < 100) {
    console.log('\n✅ Search performance is acceptable!');
  } else {
    console.log('\n⚠️  Search performance needs optimization');
  }

  await prisma.$disconnect();
}

runTests();
