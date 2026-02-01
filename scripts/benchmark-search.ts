import { searchDescriptors } from "../src/lib/search-descriptors.js";
import { prisma } from "../src/lib/prisma.js";

async function benchmark() {
  const queries = ["safety", "teamwork", "precision measurement", "quality control"];

  console.log("Benchmarking search performance...\n");

  for (const q of queries) {
    const start = Date.now();
    const response = await searchDescriptors({ query: q, limit: 20 });
    const duration = Date.now() - start;

    console.log(`Query '${q}': ${response.results.length} results (${response.total} total) in ${duration}ms`);

    if (duration > 100) {
      console.warn(`⚠ Query exceeded 100ms target`);
    }
  }

  await prisma.$disconnect();
}

benchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
