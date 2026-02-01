import { Suspense } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { searchDescriptors } from "@/lib/search-descriptors";
import { getFacetCounts } from "@/lib/queries/facet-counts";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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

  // Check if user can review
  const user = await getCurrentUser();
  const canReview = user && ["SA", "SCM", "Secretariat", "Admin"].includes(user.role);

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
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Descriptor Library</h1>
        {canReview && (
          <Button asChild variant="outline">
            <Link href="/hub/descriptors/review">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Review Templates
            </Link>
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <SearchInput />

        <FilterPanel facets={facets} />

        <div className="text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}
