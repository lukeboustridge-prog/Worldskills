"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import type { SearchResult } from "@/lib/search-descriptors";

export function DescriptorList({ results }: { results: SearchResult[] }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No descriptors found. Try adjusting your search or filters.
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {results.map((descriptor) => (
        <DescriptorCard key={descriptor.id} descriptor={descriptor} />
      ))}
    </div>
  );
}

function DescriptorCard({ descriptor }: { descriptor: SearchResult }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => copyToClipboard(text, field)}
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="group flex items-start gap-2">
            <div>
              <CardTitle className="text-lg">
                {descriptor.criterionName}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {descriptor.skillName} - {descriptor.code}
              </div>
            </div>
            <CopyButton text={descriptor.criterionName} field="criterion" />
          </div>
          <div className="flex gap-2">
            {descriptor.category && (
              <Badge variant="outline">{descriptor.category}</Badge>
            )}
            <Badge
              variant={
                descriptor.qualityIndicator === "EXCELLENT"
                  ? "default"
                  : "outline"
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
              <span className="font-medium">Excellent:</span>{" "}
              {descriptor.excellent.substring(0, 200)}
              {descriptor.excellent.length > 200 && "..."}
            </div>
            <CopyButton text={descriptor.excellent} field="excellent" />
          </div>
        )}
        {descriptor.good && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium">Good:</span>{" "}
              {descriptor.good.substring(0, 200)}
              {descriptor.good.length > 200 && "..."}
            </div>
            <CopyButton text={descriptor.good} field="good" />
          </div>
        )}
        {descriptor.pass && (
          <div className="group flex items-start gap-2 text-sm">
            <div className="flex-1">
              <span className="font-medium">Pass:</span>{" "}
              {descriptor.pass.substring(0, 200)}
              {descriptor.pass.length > 200 && "..."}
            </div>
            <CopyButton text={descriptor.pass} field="pass" />
          </div>
        )}
        {descriptor.rank !== null && (
          <div className="text-xs text-muted-foreground mt-2">
            Relevance: {(descriptor.rank * 100).toFixed(0)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
