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

interface ComparisonModalProps {
  descriptors: SearchResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComparisonModal({ descriptors, open, onOpenChange }: ComparisonModalProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLevel = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const colWidth = descriptors.length === 2 ? "w-1/2" : "w-1/3";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Descriptors</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mt-4">
          {descriptors.map((d) => (
            <div key={d.id} className={`${colWidth} space-y-3`}>
              {/* Header */}
              <div className="border-b pb-2">
                <h3 className="font-semibold text-sm line-clamp-2">{d.criterionName}</h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    {d.skillName}
                  </Badge>
                  {d.category && (
                    <Badge variant="outline" className="text-xs">{d.category}</Badge>
                  )}
                </div>
              </div>

              {/* Performance Levels */}
              <LevelSection
                label="Excellent"
                text={d.excellent}
                color="green"
                onCopy={() => d.excellent && copyLevel(d.excellent, `${d.id}-excellent`)}
                copied={copiedId === `${d.id}-excellent`}
              />
              <LevelSection
                label="Good"
                text={d.good}
                color="blue"
                onCopy={() => d.good && copyLevel(d.good, `${d.id}-good`)}
                copied={copiedId === `${d.id}-good`}
              />
              <LevelSection
                label="Pass"
                text={d.pass}
                color="yellow"
                onCopy={() => d.pass && copyLevel(d.pass, `${d.id}-pass`)}
                copied={copiedId === `${d.id}-pass`}
              />
              <LevelSection
                label="Below Pass"
                text={d.belowPass}
                color="red"
                onCopy={() => d.belowPass && copyLevel(d.belowPass, `${d.id}-below`)}
                copied={copiedId === `${d.id}-below`}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LevelSection({
  label,
  text,
  color,
  onCopy,
  copied,
}: {
  label: string;
  text: string | null;
  color: "green" | "blue" | "yellow" | "red";
  onCopy: () => void;
  copied: boolean;
}) {
  if (!text) {
    return (
      <div className="text-xs text-muted-foreground italic p-2 bg-muted/30 rounded">
        No {label.toLowerCase()} level
      </div>
    );
  }

  const colorClasses = {
    green: "bg-green-50/50 border-green-200",
    blue: "bg-blue-50/50 border-blue-200",
    yellow: "bg-yellow-50/50 border-yellow-200",
    red: "bg-red-50/50 border-red-200",
  };

  const labelColors = {
    green: "text-green-700",
    blue: "text-blue-700",
    yellow: "text-yellow-700",
    red: "text-red-700",
  };

  return (
    <div className={`border rounded p-2 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold ${labelColors[color]}`}>{label}</span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}
