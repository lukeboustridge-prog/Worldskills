"use client";

import { useState, useTransition } from "react";
import { QualityIndicator } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, ChevronDown, ChevronRight, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateDescriptorReviewAction, updateQualityIndicatorAction, deleteDescriptorAction } from "../actions";
import type { SearchResult } from "@/lib/search-descriptors";
import type { Facets } from "@/lib/queries/facet-counts";

const QUALITY_OPTIONS: { value: QualityIndicator; label: string; color: string }[] = [
  { value: "NEEDS_REVIEW", label: "Needs Review", color: "bg-amber-100 text-amber-800" },
  { value: "REFERENCE", label: "Reference", color: "bg-gray-100 text-gray-800" },
  { value: "GOOD", label: "Good", color: "bg-blue-100 text-blue-800" },
  { value: "EXCELLENT", label: "Excellent", color: "bg-green-100 text-green-800" },
];

const NO_CATEGORY = "__none__";

interface ReviewListProps {
  results: SearchResult[];
  facets: Facets;
}

export function ReviewList({ results, facets }: ReviewListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No descriptors found matching the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((descriptor) => (
        <ReviewCard key={descriptor.id} descriptor={descriptor} facets={facets} />
      ))}
    </div>
  );
}

interface ReviewCardProps {
  descriptor: SearchResult;
  facets: Facets;
}

function ReviewCard({ descriptor, facets }: ReviewCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // Form state
  const [criterionName, setCriterionName] = useState(descriptor.criterionName);
  const [score3, setScore3] = useState(descriptor.score3 || "");
  const [score2, setScore2] = useState(descriptor.score2 || "");
  const [score1, setScore1] = useState(descriptor.score1 || "");
  const [score0, setScore0] = useState(descriptor.score0 || "");
  const [quality, setQuality] = useState<QualityIndicator>(descriptor.qualityIndicator);
  const [skillName, setSkillName] = useState(descriptor.skillName);
  const [category, setCategory] = useState(descriptor.category || "");

  const handleQuickQualityChange = (newQuality: QualityIndicator) => {
    startTransition(async () => {
      const result = await updateQualityIndicatorAction(descriptor.id, newQuality);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Updated", description: "Quality indicator updated" });
        setQuality(newQuality);
      }
    });
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.set("id", descriptor.id);
    formData.set("criterionName", criterionName);
    formData.set("score3", score3);
    formData.set("score2", score2);
    formData.set("score1", score1);
    formData.set("score0", score0);
    formData.set("qualityIndicator", quality);
    formData.set("skillName", skillName);
    formData.set("category", category);

    startTransition(async () => {
      const result = await updateDescriptorReviewAction(formData);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Saved", description: "Descriptor updated successfully" });
        setEditing(false);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteDescriptorAction(descriptor.id);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Deleted", description: "Descriptor has been deleted" });
        setDeleted(true);
      }
    });
  };

  const handleCancel = () => {
    setCriterionName(descriptor.criterionName);
    setScore3(descriptor.score3 || "");
    setScore2(descriptor.score2 || "");
    setScore1(descriptor.score1 || "");
    setScore0(descriptor.score0 || "");
    setQuality(descriptor.qualityIndicator);
    setSkillName(descriptor.skillName);
    setCategory(descriptor.category || "");
    setEditing(false);
  };

  const qualityOption = QUALITY_OPTIONS.find((q) => q.value === quality);

  // Don't render if deleted
  if (deleted) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground shrink-0 mt-1"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={criterionName}
                onChange={(e) => setCriterionName(e.target.value)}
                className="font-medium"
              />
            ) : (
              <CardTitle className="text-base font-medium leading-tight">
                {criterionName}
              </CardTitle>
            )}

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {descriptor.source && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {descriptor.source}
                </Badge>
              )}
              <span>{skillName}</span>
              <span>•</span>
              <span>{descriptor.code}</span>
              {category && (
                <>
                  <span>•</span>
                  <span>{category}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick quality selector */}
            <Select
              value={quality}
              onValueChange={(value) => handleQuickQualityChange(value as QualityIndicator)}
              disabled={isPending}
            >
              <SelectTrigger className={`w-[140px] h-8 text-xs ${qualityOption?.color}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExpanded(true);
                  setEditing(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="ml-7 pt-3 border-t space-y-4">
            {editing ? (
              <>
                {/* Skill and Category row */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`skill-${descriptor.id}`}>Skill</Label>
                    <Select value={skillName} onValueChange={setSkillName}>
                      <SelectTrigger id={`skill-${descriptor.id}`}>
                        <SelectValue placeholder="Select skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {facets.skillAreas.map(({ name }) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`category-${descriptor.id}`}>Category</Label>
                    <Select
                      value={category || NO_CATEGORY}
                      onValueChange={(v) => setCategory(v === NO_CATEGORY ? "" : v)}
                    >
                      <SelectTrigger id={`category-${descriptor.id}`}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>No Category</SelectItem>
                        {facets.categories.map(({ name }) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Score fields */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`score3-${descriptor.id}`} className="text-green-700">
                      Score 3 (Excellent)
                    </Label>
                    <Textarea
                      id={`score3-${descriptor.id}`}
                      value={score3}
                      onChange={(e) => setScore3(e.target.value)}
                      rows={12}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`score2-${descriptor.id}`} className="text-blue-700">
                      Score 2 (Good)
                    </Label>
                    <Textarea
                      id={`score2-${descriptor.id}`}
                      value={score2}
                      onChange={(e) => setScore2(e.target.value)}
                      rows={12}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`score1-${descriptor.id}`} className="text-yellow-700">
                      Score 1 (Acceptable)
                    </Label>
                    <Textarea
                      id={`score1-${descriptor.id}`}
                      value={score1}
                      onChange={(e) => setScore1(e.target.value)}
                      rows={12}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`score0-${descriptor.id}`} className="text-red-700">
                      Score 0 (Below Standard)
                    </Label>
                    <Textarea
                      id={`score0-${descriptor.id}`}
                      value={score0}
                      onChange={(e) => setScore0(e.target.value)}
                      rows={12}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-between">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isPending}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Descriptor</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete this descriptor? This action can be undone by an administrator.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isPending}>
                      {isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-sm">
                {descriptor.score3 && (
                  <div>
                    <span className="font-medium text-green-700">Score 3:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score3}</span>
                  </div>
                )}
                {descriptor.score2 && (
                  <div>
                    <span className="font-medium text-blue-700">Score 2:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score2}</span>
                  </div>
                )}
                {descriptor.score1 && (
                  <div>
                    <span className="font-medium text-yellow-700">Score 1:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score1}</span>
                  </div>
                )}
                {descriptor.score0 && (
                  <div>
                    <span className="font-medium text-red-700">Score 0:</span>{" "}
                    <span className="text-muted-foreground">{descriptor.score0}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
