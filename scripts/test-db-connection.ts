import { prisma } from "../src/lib/prisma.js";

async function test() {
  console.log("Testing database connection...\n");

  try {
    const count = await prisma.descriptor.count();
    console.log(`✓ Connected! Found ${count} descriptors in database`);

    if (count > 0) {
      const sample = await prisma.descriptor.findFirst({
        where: { deletedAt: null },
        select: { id: true, criterionName: true, skillNames: true }
      });
      console.log("Sample descriptor:", sample);
    }
  } catch (err) {
    console.error("✗ Connection failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
