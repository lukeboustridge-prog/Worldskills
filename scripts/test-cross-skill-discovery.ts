import { PrismaClient } from "@prisma/client";
import { getRelatedDescriptors } from "../src/lib/queries/related-descriptors.js";

const prisma = new PrismaClient();

async function test() {
  console.log("Testing cross-skill discovery...\n");

  // Find a 'safety' descriptor
  const safety = await prisma.descriptor.findFirst({
    where: {
      deletedAt: null,
      criterionName: { contains: "safety", mode: "insensitive" }
    },
    select: { id: true, criterionName: true, skillNames: true }
  });

  if (!safety) {
    console.log("No safety descriptor found");
    process.exit(1);
  }

  console.log("Source safety descriptor:");
  console.log("  Skills:", safety.skillNames.join(", "));
  console.log("  Criterion:", safety.criterionName);

  const related = await getRelatedDescriptors(safety.id, 10, 0.25);
  console.log("\nRelated descriptors from OTHER skills:");

  // Compare skills - check if there's any overlap
  const otherSkills = related.filter(r => !r.skillNames.some(s => safety.skillNames.includes(s)));
  otherSkills.forEach(r => {
    console.log("  -", r.skillNames.join(", "), ":", r.criterionName.substring(0, 60), "(", r.similarityScore.toFixed(2), ")");
  });

  console.log("\nCross-skill discovery:", otherSkills.length > 0 ? "WORKING" : "NO RESULTS");

  if (otherSkills.length > 0) {
    console.log("\n✓ Cross-skill discovery validated");
  } else {
    console.log("\n⚠ No cross-skill results (may need more data or lower threshold)");
  }
}

test()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
