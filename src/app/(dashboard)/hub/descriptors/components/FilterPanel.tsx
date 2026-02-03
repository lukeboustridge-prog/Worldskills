"use client";

import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface Facets {
  categories: Array<{ name: string; count: number }>;
  qualities: Array<{ name: string; count: number }>;
}

const QUALITY_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  REFERENCE: "Reference",
  NEEDS_REVIEW: "Needs Review",
};

const ALL_VALUE = "__all__";

export function FilterPanel({ facets }: { facets: Facets }) {
  const [category, setCategory] = useQueryState("category", { shallow: false });
  const [quality, setQuality] = useQueryState("quality", { shallow: false });

  const hasFilters = category || quality;

  const clearAll = () => {
    setCategory(null);
    setQuality(null);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value === ALL_VALUE ? null : value);
  };

  const handleQualityChange = (value: string) => {
    setQuality(value === ALL_VALUE ? null : value);
  };

  return (
    <div className="space-y-3">
      {/* Filter dropdowns row */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={category || ALL_VALUE}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All WSOS Sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All WSOS Sections</SelectItem>
            {facets.categories.map(({ name, count }) => (
              <SelectItem key={name} value={name}>
                {name} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={quality || ALL_VALUE}
          onValueChange={handleQualityChange}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Quality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Quality</SelectItem>
            {facets.qualities.map(({ name, count }) => (
              <SelectItem key={name} value={name}>
                {QUALITY_LABELS[name] || name} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-10">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {category && (
            <Badge variant="outline" className="gap-1">
              {category}
              <button onClick={() => setCategory(null)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {quality && (
            <Badge variant="outline" className="gap-1">
              {QUALITY_LABELS[quality] || quality}
              <button onClick={() => setQuality(null)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
