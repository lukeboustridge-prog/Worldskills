"use client";

import { Button } from "@/components/ui/button";
import { X, GitCompare } from "lucide-react";
import type { SearchResult } from "@/lib/search-descriptors";

interface ComparisonBarProps {
  selected: SearchResult[];
  onClear: () => void;
  onCompare: () => void;
  onRemove: (id: string) => void;
}

export function ComparisonBar({ selected, onClear, onCompare, onRemove }: ComparisonBarProps) {
  if (selected.length === 0) return null;

  const canCompare = selected.length >= 2 && selected.length <= 3;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        {/* Selected count and items */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium whitespace-nowrap">
            {selected.length} selected
          </span>
          <div className="flex gap-1 flex-wrap">
            {selected.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs"
              >
                <span className="max-w-[80px] md:max-w-[100px] truncate">
                  {d.criterionName}
                </span>
                <button
                  onClick={() => onRemove(d.id)}
                  className="hover:text-destructive shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClear} className="flex-1 md:flex-none">
            Clear
          </Button>
          <Button
            size="sm"
            onClick={onCompare}
            disabled={!canCompare}
            title={!canCompare ? "Select 2-3 descriptors to compare" : "Compare selected"}
            className="flex-1 md:flex-none"
          >
            <GitCompare className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Compare</span>
            {canCompare && <span className="ml-1">({selected.length})</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
