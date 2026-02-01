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
    select: { id: true, criterionName: true, skillName: true }
  });

  if (!safety) {
    console.log("No safety descriptor found");
    process.exit(1);
  }

  console.log("Source safety descriptor:");
  console.log("  Skill:", safety.skillName);
  console.log("  Criterion:", safety.criterionName);

  const related = await getRelatedDescriptors(safety.id, 10, 0.25);
  console.log("\nRelated descriptors from OTHER skills:");

  const otherSkills = related.filter(r => r.skillName !== safety.skillName);
  otherSkills.forEach(r => {
    console.log("  -", r.skillName, ":", r.criterionName.substring(0, 60), "(", r.similarityScore.toFixed(2), ")");
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
