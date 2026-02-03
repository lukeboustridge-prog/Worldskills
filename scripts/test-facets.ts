import { getFacetCounts } from "../src/lib/queries/facet-counts.js";

async function test() {
  const allFacets = await getFacetCounts();
  console.log("All categories:", allFacets.categories.slice(0, 3));

  const safetyFacets = await getFacetCounts("safety");
  console.log("Safety-filtered categories:", safetyFacets.categories.slice(0, 3));

  const allTotal = allFacets.categories.reduce((sum, f) => sum + f.count, 0);
  const safetyTotal = safetyFacets.categories.reduce((sum, f) => sum + f.count, 0);
  console.log("Filtering works:", safetyTotal < allTotal);

  if (safetyTotal < allTotal) {
    console.log("✓ Facet counts work correctly");
  } else {
    console.log("✗ Facet filtering test failed");
    process.exit(1);
  }
}

test().catch(console.error);
