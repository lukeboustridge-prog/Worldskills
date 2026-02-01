import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyIndex() {
  console.log("Verifying FTS index exists...\n");

  const result = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'Descriptor'
    AND indexname = 'idx_descriptors_fts'
  `;

  if (result.length > 0) {
    console.log("✓ FTS index found:", result[0].indexname);
    process.exit(0);
  } else {
    console.error("✗ FTS index not found");
    process.exit(1);
  }
}

verifyIndex()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
