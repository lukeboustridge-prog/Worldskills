import { searchDescriptors } from "../src/lib/search-descriptors.js";
import { prisma } from "../src/lib/prisma.js";

async function test() {
  console.log("Testing searchDescriptors function...\n");

  try {
    const response = await searchDescriptors({ query: "safety", limit: 5 });
    console.log("Results count:", response.results.length);
    console.log("Total:", response.total);

    if (response.results.length > 0) {
      console.log("First result rank:", response.results[0]?.rank);
      console.log("First result criterion:", response.results[0]?.criterionName);

      if (response.results[0].rank !== null) {
        console.log("\n✓ Search returns ranked results");
      } else {
        console.log("\n✗ Search did not return ranked results");
        process.exit(1);
      }
    } else {
      console.log("⚠ No results found for 'safety' query");
    }
  } finally {
    await prisma.$disconnect();
  }
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
