"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DescriptorModal } from "./DescriptorModal";
import { ComparisonBar } from "./ComparisonBar";
import { ComparisonModal } from "./ComparisonModal";
import type { SearchResult } from "@/lib/search-descriptors";

const MAX_COMPARE = 3;

const QUALITY_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  REFERENCE: "Reference",
  NEEDS_REVIEW: "Needs Review",
};

export function DescriptorList({ results }: { results: SearchResult[] }) {
  const { toast } = useToast();
  const [selectedDescriptor, setSelectedDescriptor] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<SearchResult[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const toggleSelect = (descriptor: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();

    const isSelected = selected.some((d) => d.id === descriptor.id);

    if (isSelected) {
      setSelected(selected.filter((d) => d.id !== descriptor.id));
    } else {
      if (selected.length >= MAX_COMPARE) {
        toast({
          title: "Maximum selection reached",
          description: `You can only compare up to ${MAX_COMPARE} descriptors at a time`,
        });
        return;
      }
      setSelected([...selected, descriptor]);
    }
  };

  const removeFromSelection = (id: string) => {
    setSelected(selected.filter((d) => d.id !== id));
  };

  const clearSelection = () => {
    setSelected([]);
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No descriptors found. Try adjusting your search or filters.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 mt-4">
        {results.map((descriptor) => (
          <DescriptorCard
            key={descriptor.id}
            descriptor={descriptor}
            isSelected={selected.some((d) => d.id === descriptor.id)}
            onSelect={(e) => toggleSelect(descriptor, e)}
            onClick={() => setSelectedDescriptor(descriptor)}
          />
        ))}
      </div>

      <DescriptorModal
        descriptor={selectedDescriptor}
        open={selectedDescriptor !== null}
        onOpenChange={(open) => !open && setSelectedDescriptor(null)}
      />

      <ComparisonBar
        selected={selected}
        onClear={clearSelection}
        onCompare={() => setCompareOpen(true)}
        onRemove={removeFromSelection}
      />

      <ComparisonModal
        descriptors={selected}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
    </>
  );
}

function DescriptorCard({
  descriptor,
  isSelected,
  onSelect,
  onClick,
}: {
  descriptor: SearchResult;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      className={`border rounded-lg transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "hover:border-primary/50 bg-card"
      }`}
    >
      {/* Main row - always visible */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={onClick}>
        <div onClick={onSelect}>
          <Checkbox
            checked={isSelected}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        <button
          onClick={toggleExpand}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight">
            {descriptor.criterionName}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={descriptor.qualityIndicator === "EXCELLENT" ? "default" : "outline"}
            className={`text-xs ${
              descriptor.qualityIndicator === "REFERENCE"
                ? "bg-green-100 text-green-800 border-green-200"
                : descriptor.qualityIndicator === "NEEDS_REVIEW"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : ""
            }`}
          >
            {QUALITY_LABELS[descriptor.qualityIndicator] || descriptor.qualityIndicator}
          </Badge>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 ml-14 border-t mt-0 pt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {descriptor.source && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {descriptor.source}
              </Badge>
            )}
            <span>{descriptor.skillNames?.join(", ") || "No skills"}</span>
            <span>•</span>
            <span>{descriptor.code}</span>
            {descriptor.categories && descriptor.categories.length > 0 && (
              <>
                <span>•</span>
                <span>{descriptor.categories.join(", ")}</span>
              </>
            )}
          </div>

          {descriptor.score3 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-green-700">Score 3:</span>{" "}
              {descriptor.score3.substring(0, 100)}
              {descriptor.score3.length > 100 && "..."}
            </p>
          )}

          <p className="text-xs text-primary cursor-pointer hover:underline" onClick={onClick}>
            Click to view full details →
          </p>
        </div>
      )}
    </div>
  );
}
