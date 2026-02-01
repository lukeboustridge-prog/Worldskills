import { prisma } from "../src/lib/prisma.js";

async function createIndex() {
  console.log("Creating pg_trgm GIN index on Descriptor.criterionName...\n");

  try {
    // Create the trigram index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_descriptors_trgm
      ON "Descriptor"
      USING GIN ("criterionName" gin_trgm_ops)
    `);

    console.log("✓ Index created successfully");

    // Verify it exists
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'Descriptor'
      AND indexname = 'idx_descriptors_trgm'
    `;

    if (indexes.length > 0) {
      console.log("✓ Verified: idx_descriptors_trgm exists");
    } else {
      console.log("❌ Index was not created");
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to create index:", err);
    process.exit(1);
  }
}

createIndex()
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
