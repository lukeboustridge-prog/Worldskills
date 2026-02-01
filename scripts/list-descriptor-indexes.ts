import { prisma } from "../src/lib/prisma.js";

async function listIndexes() {
  console.log("Listing all indexes on Descriptor table...\n");

  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'Descriptor'
    ORDER BY indexname
  `;

  if (indexes.length === 0) {
    console.log("No indexes found");
    process.exit(1);
  }

  indexes.forEach(idx => {
    console.log("Index:", idx.indexname);
    console.log("  ", idx.indexdef);
    console.log("");
  });

  console.log(`Total indexes: ${indexes.length}`);
}

listIndexes()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
