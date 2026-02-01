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
                label="Score 3"
                text={d.score3}
                color="green"
                onCopy={() => d.score3 && copyLevel(d.score3, `${d.id}-score3`)}
                copied={copiedId === `${d.id}-score3`}
              />
              <LevelSection
                label="Score 2"
                text={d.score2}
                color="blue"
                onCopy={() => d.score2 && copyLevel(d.score2, `${d.id}-score2`)}
                copied={copiedId === `${d.id}-score2`}
              />
              <LevelSection
                label="Score 1"
                text={d.score1}
                color="yellow"
                onCopy={() => d.score1 && copyLevel(d.score1, `${d.id}-score1`)}
                copied={copiedId === `${d.id}-score1`}
              />
              <LevelSection
                label="Score 0"
                text={d.score0}
                color="red"
                onCopy={() => d.score0 && copyLevel(d.score0, `${d.id}-score0`)}
                copied={copiedId === `${d.id}-score0`}
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
