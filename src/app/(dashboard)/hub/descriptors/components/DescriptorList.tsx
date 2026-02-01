"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Check } from "lucide-react";
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
      <div className="space-y-4 mt-4">
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
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (
    e: React.MouseEvent,
    text: string,
    field: string,
    label: string
  ) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied to clipboard",
        description: `${label} copied successfully`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const CopyButton = ({
    text,
    field,
    label,
  }: {
    text: string;
    field: string;
    label: string;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => copyToClipboard(e, text, field, label)}
      title="Copy to clipboard"
    >
      {copiedField === field ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );

  return (
    <Card
      className={`cursor-pointer transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "hover:border-primary/50"
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div
            className="pt-1"
            onClick={onSelect}
          >
            <Checkbox
              checked={isSelected}
              className="data-[state=checked]:bg-primary"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="group flex items-start gap-2 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg">{descriptor.criterionName}</CardTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {descriptor.source && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                      >
                        {descriptor.source}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {descriptor.skillName} - {descriptor.code}
                    </span>
                  </div>
                </div>
                <CopyButton
                  text={descriptor.criterionName}
                  field="criterion"
                  label="Criterion name"
                />
              </div>
              <div className="flex gap-2 flex-wrap justify-end shrink-0">
                {descriptor.category && (
                  <Badge variant="outline" className="whitespace-nowrap">{descriptor.category}</Badge>
                )}
                <Badge
                  variant={
                    descriptor.qualityIndicator === "EXCELLENT" ? "default" : "outline"
                  }
                  className="whitespace-nowrap"
                >
                  {QUALITY_LABELS[descriptor.qualityIndicator] || descriptor.qualityIndicator}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 ml-7">
        {descriptor.score3 && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium text-green-700">Score 3:</span>{" "}
              {descriptor.score3.substring(0, 150)}
              {descriptor.score3.length > 150 && "..."}
            </div>
            <CopyButton
              text={descriptor.score3}
              field="score3"
              label="Score 3"
            />
          </div>
        )}
        {descriptor.score2 && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium text-blue-700">Score 2:</span>{" "}
              {descriptor.score2.substring(0, 150)}
              {descriptor.score2.length > 150 && "..."}
            </div>
            <CopyButton text={descriptor.score2} field="score2" label="Score 2" />
          </div>
        )}
        {descriptor.score1 && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium text-yellow-700">Score 1:</span>{" "}
              {descriptor.score1.substring(0, 150)}
              {descriptor.score1.length > 150 && "..."}
            </div>
            <CopyButton text={descriptor.score1} field="score1" label="Score 1" />
          </div>
        )}
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>Click to view full details</span>
          {descriptor.rank !== null && (
            <span>Relevance: {(descriptor.rank * 100).toFixed(0)}%</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
