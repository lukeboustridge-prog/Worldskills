import { searchDescriptors } from "../src/lib/search-descriptors.js";

async function test() {
  const page1 = await searchDescriptors({ query: "safety", page: 1, limit: 5 });
  const page2 = await searchDescriptors({ query: "safety", page: 2, limit: 5 });

  console.log("Page 1:", page1.results.length, "total:", page1.total, "hasMore:", page1.hasMore);
  console.log("Page 2:", page2.results.length, "ids differ:", page1.results[0]?.id !== page2.results[0]?.id);

  if (page1.hasMore && page1.results[0]?.id !== page2.results[0]?.id) {
    console.log("✓ Pagination works correctly");
  } else {
    console.log("✗ Pagination test failed");
    process.exit(1);
  }
}

test().catch(console.error);
