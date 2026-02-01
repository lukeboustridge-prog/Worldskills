import { Suspense } from "react";
import { searchDescriptors } from "@/lib/search-descriptors";
import { getFacetCounts } from "@/lib/queries/facet-counts";
import { SearchInput } from "./components/SearchInput";
import { FilterPanel } from "./components/FilterPanel";
import { DescriptorList } from "./components/DescriptorList";
import { Pagination } from "./components/Pagination";
import { QualityIndicator } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    skill?: string;
    category?: string;
    quality?: string;
    page?: string;
  }>;
}

export default async function DescriptorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;

  // Fetch search results and facet counts in parallel
  const [searchResponse, facets] = await Promise.all([
    searchDescriptors({
      query: params.q,
      skillName: params.skill,
      category: params.category,
      qualityIndicator: params.quality as QualityIndicator | undefined,
      page,
      limit,
    }),
    getFacetCounts(params.q),
  ]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Descriptor Library</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <FilterPanel facets={facets} />
        </aside>

        <main className="md:col-span-3">
          <SearchInput />

          <div className="mt-4 text-sm text-muted-foreground">
            {searchResponse.total} descriptor{searchResponse.total !== 1 ? "s" : ""} found
          </div>

          <Suspense fallback={<div className="py-8">Loading...</div>}>
            <DescriptorList results={searchResponse.results} />
          </Suspense>

          <Pagination
            currentPage={page}
            totalPages={Math.ceil(searchResponse.total / limit)}
            hasMore={searchResponse.hasMore}
          />
        </main>
      </div>
    </div>
  );
}
