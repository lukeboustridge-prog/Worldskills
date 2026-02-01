import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QualityIndicator } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { searchDescriptors } from "@/lib/search-descriptors";
import { getFacetCounts } from "@/lib/queries/facet-counts";
import { ReviewList } from "./components/ReviewList";
import { ReviewFilters } from "./components/ReviewFilters";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    quality?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function ReviewDescriptorsPage({ searchParams }: PageProps) {
  const session = await requireUser();

  // Check permissions
  const allowedRoles = ["SA", "SCM", "Secretariat", "Admin"];
  if (!allowedRoles.includes(session.role)) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">
          You do not have permission to review descriptors.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;

  // Default to NEEDS_REVIEW if no quality filter specified
  const qualityFilter = params.quality || "NEEDS_REVIEW";

  const [searchResponse, facets] = await Promise.all([
    searchDescriptors({
      query: params.q,
      category: params.category,
      qualityIndicator: qualityFilter as QualityIndicator,
      page,
      limit,
    }),
    getFacetCounts(params.q),
  ]);

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/hub/descriptors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Review Descriptors</h1>
        <p className="text-muted-foreground mt-1">
          Review and approve template descriptors. Set quality indicators and edit content as needed.
        </p>
      </div>

      <div className="space-y-4">
        <ReviewFilters
          facets={facets}
          currentQuality={qualityFilter}
        />

        <div className="text-sm text-muted-foreground">
          {searchResponse.total} descriptor{searchResponse.total !== 1 ? "s" : ""} to review
        </div>

        <Suspense fallback={<div className="py-8">Loading...</div>}>
          <ReviewList results={searchResponse.results} />
        </Suspense>

        {searchResponse.total > limit && (
          <div className="flex justify-center gap-2 pt-4">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={`/hub/descriptors/review?quality=${qualityFilter}&page=${page - 1}`}>
                  Previous
                </Link>
              </Button>
            )}
            {searchResponse.hasMore && (
              <Button asChild variant="outline">
                <Link href={`/hub/descriptors/review?quality=${qualityFilter}&page=${page + 1}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
