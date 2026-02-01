import { prisma } from "../src/lib/prisma.js";

async function checkIndex() {
  console.log("Checking pg_trgm index on Descriptor table...\n");

  // Check if index exists
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'Descriptor'
    AND indexname LIKE '%trgm%'
  `;

  if (indexes.length === 0) {
    console.log("❌ No pg_trgm index found on Descriptor table");
    process.exit(1);
  }

  console.log("Found pg_trgm index:");
  indexes.forEach(idx => {
    console.log("  -", idx.indexname);
    console.log("    ", idx.indexdef.substring(0, 100) + "...");
  });
  console.log("");

  // Run EXPLAIN on a similarity query to check if index is used
  console.log("Testing query performance with EXPLAIN ANALYZE...\n");

  const explain = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN ANALYZE
    SELECT id, similarity("criterionName", 'safety measurement') as sim
    FROM "Descriptor"
    WHERE similarity("criterionName", 'safety measurement') > 0.3
    ORDER BY sim DESC
    LIMIT 5`
  );

  console.log("Query plan:");
  explain.forEach(row => console.log("  ", row["QUERY PLAN"]));
  console.log("");

  // Check if index scan is in the plan
  const planText = explain.map(r => r["QUERY PLAN"]).join(" ");
  const usesIndex = planText.includes("idx_descriptors_trgm") || planText.includes("Index Scan");
  const usesSeqScan = planText.includes("Seq Scan");

  // Extract execution time
  const timeMatch = planText.match(/Execution Time: ([\d.]+) ms/);
  const executionTime = timeMatch ? parseFloat(timeMatch[1]) : null;

  if (usesIndex) {
    console.log("✓ Index is being used for similarity queries");
  } else if (usesSeqScan) {
    if (executionTime && executionTime < 50) {
      console.log("⚠ Sequential scan used, but performance acceptable (<50ms)");
      console.log("  (PostgreSQL may prefer seq scan for small tables)");
    } else {
      console.log("⚠ Sequential scan used with execution time:", executionTime, "ms");
      console.log("  Consider analyzing table or adjusting similarity threshold");
    }
  }

  if (executionTime) {
    console.log(`\nExecution time: ${executionTime.toFixed(2)} ms`);
    if (executionTime < 100) {
      console.log("✓ Performance is acceptable (<100ms)");
    } else {
      console.log("⚠ Performance may need optimization (>100ms)");
    }
  }
}

checkIndex()
  .catch((err) => {
    console.error("Check failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
