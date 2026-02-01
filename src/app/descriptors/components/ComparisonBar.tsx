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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selected.length} selected
        </span>
        <div className="flex gap-1">
          {selected.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs"
            >
              <span className="max-w-[100px] truncate">{d.criterionName}</span>
              <button
                onClick={() => onRemove(d.id)}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button
          size="sm"
          onClick={onCompare}
          disabled={!canCompare}
          title={!canCompare ? "Select 2-3 descriptors to compare" : "Compare selected"}
        >
          <GitCompare className="h-4 w-4 mr-2" />
          Compare {canCompare ? `(${selected.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
