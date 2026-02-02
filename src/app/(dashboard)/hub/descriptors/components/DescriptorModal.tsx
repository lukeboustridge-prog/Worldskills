"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { SearchResult } from "@/lib/search-descriptors";

const QUALITY_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  REFERENCE: "Reference",
  NEEDS_REVIEW: "Needs Review",
};

interface DescriptorModalProps {
  descriptor: SearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DescriptorModal({ descriptor, open, onOpenChange }: DescriptorModalProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!descriptor) return null;

  const copyToClipboard = async (text: string, field: string, label: string) => {
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

  const copyAllLevels = async () => {
    const levels = [
      descriptor.score3 && `Score 3: ${descriptor.score3}`,
      descriptor.score2 && `Score 2: ${descriptor.score2}`,
      descriptor.score1 && `Score 1: ${descriptor.score1}`,
      descriptor.score0 && `Score 0: ${descriptor.score0}`,
    ].filter(Boolean).join("\n\n");

    const fullText = `${descriptor.criterionName}\n\n${levels}`;
    await copyToClipboard(fullText, "all", "Complete criterion");
  };

  const CopyButton = ({ text, field, label }: { text: string; field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      onClick={() => copyToClipboard(text, field, label)}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      <span className="ml-1 text-xs">Copy</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl pr-8">{descriptor.criterionName}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              {descriptor.source && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {descriptor.source}
                </Badge>
              )}
              {descriptor.skillNames?.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
              {descriptor.categories?.map((cat) => (
                <Badge key={cat} variant="outline">{cat}</Badge>
              ))}
              <Badge
                variant={descriptor.qualityIndicator === "EXCELLENT" ? "default" : "outline"}
              >
                {QUALITY_LABELS[descriptor.qualityIndicator] || descriptor.qualityIndicator}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={copyAllLevels}>
              <Copy className="h-4 w-4 mr-2" />
              Copy All Levels
            </Button>
          </div>

          {descriptor.score3 && (
            <div className="border rounded-lg p-4 bg-green-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-green-700">Score 3</span>
                <CopyButton text={descriptor.score3} field="score3" label="Score 3" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.score3}</p>
            </div>
          )}

          {descriptor.score2 && (
            <div className="border rounded-lg p-4 bg-blue-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-700">Score 2</span>
                <CopyButton text={descriptor.score2} field="score2" label="Score 2" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.score2}</p>
            </div>
          )}

          {descriptor.score1 && (
            <div className="border rounded-lg p-4 bg-yellow-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-yellow-700">Score 1</span>
                <CopyButton text={descriptor.score1} field="score1" label="Score 1" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.score1}</p>
            </div>
          )}

          {descriptor.score0 && (
            <div className="border rounded-lg p-4 bg-red-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-red-700">Score 0</span>
                <CopyButton text={descriptor.score0} field="score0" label="Score 0" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.score0}</p>
            </div>
          )}

          {descriptor.tags && descriptor.tags.length > 0 && (
            <div className="pt-4 border-t">
              <span className="text-sm font-medium text-muted-foreground">Tags: </span>
              {descriptor.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="mr-1">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-2 border-t">
            Code: {descriptor.code} | Sector: {descriptor.sector || "N/A"} | Source: {descriptor.source || "N/A"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
