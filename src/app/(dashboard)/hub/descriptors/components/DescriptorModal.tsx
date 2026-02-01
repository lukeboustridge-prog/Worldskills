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
      descriptor.excellent && `Excellent: ${descriptor.excellent}`,
      descriptor.good && `Good: ${descriptor.good}`,
      descriptor.pass && `Pass: ${descriptor.pass}`,
      descriptor.belowPass && `Below Pass: ${descriptor.belowPass}`,
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
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                WSC2024: {descriptor.skillName}
              </Badge>
              {descriptor.category && (
                <Badge variant="outline">{descriptor.category}</Badge>
              )}
              <Badge
                variant={descriptor.qualityIndicator === "EXCELLENT" ? "default" : "outline"}
              >
                {descriptor.qualityIndicator}
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

          {descriptor.excellent && (
            <div className="border rounded-lg p-4 bg-green-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-green-700">Excellent</span>
                <CopyButton text={descriptor.excellent} field="excellent" label="Excellent level" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.excellent}</p>
            </div>
          )}

          {descriptor.good && (
            <div className="border rounded-lg p-4 bg-blue-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-700">Good</span>
                <CopyButton text={descriptor.good} field="good" label="Good level" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.good}</p>
            </div>
          )}

          {descriptor.pass && (
            <div className="border rounded-lg p-4 bg-yellow-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-yellow-700">Pass</span>
                <CopyButton text={descriptor.pass} field="pass" label="Pass level" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.pass}</p>
            </div>
          )}

          {descriptor.belowPass && (
            <div className="border rounded-lg p-4 bg-red-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-red-700">Below Pass</span>
                <CopyButton text={descriptor.belowPass} field="belowPass" label="Below Pass level" />
              </div>
              <p className="text-sm whitespace-pre-wrap">{descriptor.belowPass}</p>
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
            Code: {descriptor.code} | Sector: {descriptor.sector || "N/A"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
