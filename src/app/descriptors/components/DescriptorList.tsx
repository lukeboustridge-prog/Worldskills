"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DescriptorModal } from "./DescriptorModal";
import type { SearchResult } from "@/lib/search-descriptors";

export function DescriptorList({ results }: { results: SearchResult[] }) {
  const [selectedDescriptor, setSelectedDescriptor] = useState<SearchResult | null>(null);

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
            onClick={() => setSelectedDescriptor(descriptor)}
          />
        ))}
      </div>

      <DescriptorModal
        descriptor={selectedDescriptor}
        open={selectedDescriptor !== null}
        onOpenChange={(open) => !open && setSelectedDescriptor(null)}
      />
    </>
  );
}

function DescriptorCard({
  descriptor,
  onClick,
}: {
  descriptor: SearchResult;
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
    e.stopPropagation(); // Prevent card click
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
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="group flex items-start gap-2">
            <div>
              <CardTitle className="text-lg">{descriptor.criterionName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                >
                  WSC2024
                </Badge>
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
          <div className="flex gap-2">
            {descriptor.category && (
              <Badge variant="outline">{descriptor.category}</Badge>
            )}
            <Badge
              variant={
                descriptor.qualityIndicator === "EXCELLENT" ? "default" : "outline"
              }
            >
              {descriptor.qualityIndicator}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {descriptor.excellent && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium text-green-700">Excellent:</span>{" "}
              {descriptor.excellent.substring(0, 150)}
              {descriptor.excellent.length > 150 && "..."}
            </div>
            <CopyButton
              text={descriptor.excellent}
              field="excellent"
              label="Excellent level"
            />
          </div>
        )}
        {descriptor.good && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium text-blue-700">Good:</span>{" "}
              {descriptor.good.substring(0, 150)}
              {descriptor.good.length > 150 && "..."}
            </div>
            <CopyButton text={descriptor.good} field="good" label="Good level" />
          </div>
        )}
        {descriptor.pass && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium text-yellow-700">Pass:</span>{" "}
              {descriptor.pass.substring(0, 150)}
              {descriptor.pass.length > 150 && "..."}
            </div>
            <CopyButton text={descriptor.pass} field="pass" label="Pass level" />
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
