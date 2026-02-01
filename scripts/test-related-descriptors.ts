import { PrismaClient } from "@prisma/client";
import { getRelatedDescriptors, getRelatedByCriterionName } from "../src/lib/queries/related-descriptors.js";

const prisma = new PrismaClient();

async function test() {
  console.log("Testing related descriptors functions...\n");

  // Get a random descriptor
  const sample = await prisma.descriptor.findFirst({
    where: { deletedAt: null },
    select: { id: true, criterionName: true, skillName: true }
  });

  if (!sample) {
    console.log("No descriptors found");
    process.exit(1);
  }

  console.log("Source descriptor:");
  console.log("  Criterion:", sample.criterionName);
  console.log("  Skill:", sample.skillName);
  console.log("");

  // Test by ID
  const relatedById = await getRelatedDescriptors(sample.id);
  console.log("Related by ID:", relatedById.length, "results");
  relatedById.forEach(r => {
    console.log("  -", r.similarityScore.toFixed(2), r.skillName, "-", r.criterionName.substring(0, 50));
  });
  console.log("");

  // Test by text
  const relatedByText = await getRelatedByCriterionName(sample.criterionName);
  console.log("Related by text:", relatedByText.length, "results");

  if (relatedById.length > 0) {
    console.log("\n✓ Related descriptors function works");
  } else {
    console.log("\n⚠ No related descriptors found (may need lower threshold)");
  }
}

test()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
