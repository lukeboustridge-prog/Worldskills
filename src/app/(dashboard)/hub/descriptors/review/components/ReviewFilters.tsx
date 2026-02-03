"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Facets {
  categories: Array<{ name: string; count: number }>;
  qualities: Array<{ name: string; count: number }>;
}

const QUALITY_OPTIONS = [
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "REFERENCE", label: "Reference" },
  { value: "GOOD", label: "Good" },
  { value: "EXCELLENT", label: "Excellent" },
];

export function ReviewFilters({
  facets,
  currentQuality,
}: {
  facets: Facets;
  currentQuality: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setQualityFilter = (quality: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("quality", quality);
    params.delete("page");
    router.push(`/hub/descriptors/review?${params.toString()}`);
  };

  // Get count for each quality level from facets
  const getCount = (quality: string) => {
    const found = facets.qualities.find((q) => q.name === quality);
    return found?.count || 0;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {QUALITY_OPTIONS.map((option) => {
        const count = getCount(option.value);
        const isActive = currentQuality === option.value;

        return (
          <Button
            key={option.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => setQualityFilter(option.value)}
            className="gap-2"
          >
            {option.label}
            <Badge variant={isActive ? "outline" : "outline"} className="ml-1">
              {count}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
