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
  skillAreas: Array<{ name: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  qualities: Array<{ name: string; count: number }>;
}

const QUALITY_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  REFERENCE: "Reference",
  NEEDS_REVIEW: "Needs Review",
};

export function FilterPanel({ facets }: { facets: Facets }) {
  const [skill, setSkill] = useQueryState("skill", { shallow: false });
  const [category, setCategory] = useQueryState("category", { shallow: false });
  const [quality, setQuality] = useQueryState("quality", { shallow: false });

  const hasFilters = skill || category || quality;

  const clearAll = () => {
    setSkill(null);
    setCategory(null);
    setQuality(null);
  };

  return (
    <div className="space-y-3">
      {/* Filter dropdowns row */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={skill || ""}
          onValueChange={(value) => setSkill(value || null)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Skills" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Skills</SelectItem>
            {facets.skillAreas.map(({ name, count }) => (
              <SelectItem key={name} value={name}>
                {name} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={category || ""}
          onValueChange={(value) => setCategory(value || null)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {facets.categories.map(({ name, count }) => (
              <SelectItem key={name} value={name}>
                {name} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={quality || ""}
          onValueChange={(value) => setQuality(value || null)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Quality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Quality</SelectItem>
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
          {skill && (
            <Badge variant="outline" className="gap-1">
              {skill}
              <button onClick={() => setSkill(null)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
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
