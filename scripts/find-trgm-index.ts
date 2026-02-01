import { prisma } from "../src/lib/prisma.js";

async function findTrgrm() {
  console.log("Searching for trigram indexes...\n");

  // Check for gin_trgm_ops operator class usage
  const trgramIndexes = await prisma.$queryRaw<Array<{
    schemaname: string;
    tablename: string;
    indexname: string;
    indexdef: string;
  }>>`
    SELECT
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE indexdef LIKE '%gin_trgm_ops%'
    ORDER BY tablename, indexname
  `;

  if (trgramIndexes.length === 0) {
    console.log("❌ No trigram indexes found in the database");
    console.log("\nThe pg_trgm index may not have been created.");
    console.log("According to the plan, it should have been created in Phase 2 (02-01) migration.");
  } else {
    console.log("Found trigram indexes:");
    trgramIndexes.forEach(idx => {
      console.log(`\nTable: ${idx.tablename}`);
      console.log(`Index: ${idx.indexname}`);
      console.log(`Definition: ${idx.indexdef}`);
    });
  }

  // Check if pg_trgm extension is installed
  const extensions = await prisma.$queryRaw<Array<{ extname: string; extversion: string }>>`
    SELECT extname, extversion
    FROM pg_extension
    WHERE extname = 'pg_trgm'
  `;

  console.log("\n---");
  if (extensions.length > 0) {
    console.log("✓ pg_trgm extension is installed (version", extensions[0].extversion + ")");
  } else {
    console.log("❌ pg_trgm extension is NOT installed");
  }
}

findTrgrm()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
