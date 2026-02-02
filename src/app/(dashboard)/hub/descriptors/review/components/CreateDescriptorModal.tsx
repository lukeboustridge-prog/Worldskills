"use client";

import { useState, useTransition } from "react";
import { QualityIndicator } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createDescriptorAction } from "../actions";
import type { Facets } from "@/lib/queries/facet-counts";

const QUALITY_OPTIONS: { value: QualityIndicator; label: string }[] = [
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "REFERENCE", label: "Reference" },
  { value: "GOOD", label: "Good" },
  { value: "EXCELLENT", label: "Excellent" },
];

interface CreateDescriptorModalProps {
  facets: Facets;
}

export function CreateDescriptorModal({ facets }: CreateDescriptorModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [criterionName, setCriterionName] = useState("");
  const [score3, setScore3] = useState("");
  const [score2, setScore2] = useState("");
  const [score1, setScore1] = useState("");
  const [score0, setScore0] = useState("");
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [quality, setQuality] = useState<QualityIndicator>("NEEDS_REVIEW");

  const resetForm = () => {
    setCode("");
    setCriterionName("");
    setScore3("");
    setScore2("");
    setScore1("");
    setScore0("");
    setSkillNames([]);
    setCategories([]);
    setQuality("NEEDS_REVIEW");
  };

  const toggleSkill = (skill: string) => {
    setSkillNames(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const toggleCategory = (category: string) => {
    setCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleCreate = () => {
    if (!code.trim() || !criterionName.trim() || skillNames.length === 0) {
      toast({
        title: "Validation Error",
        description: "Code, criterion name, and at least one skill are required",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.set("code", code);
    formData.set("criterionName", criterionName);
    formData.set("score3", score3);
    formData.set("score2", score2);
    formData.set("score1", score1);
    formData.set("score0", score0);
    formData.set("skillNames", JSON.stringify(skillNames));
    formData.set("categories", JSON.stringify(categories));
    formData.set("qualityIndicator", quality);

    startTransition(async () => {
      const result = await createDescriptorAction(formData);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Created", description: "Descriptor created successfully" });
        resetForm();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Descriptor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Descriptor</DialogTitle>
          <DialogDescription>
            Add a new descriptor template to the library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic info row */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., A1, B2.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quality">Quality Indicator</Label>
              <Select value={quality} onValueChange={(v) => setQuality(v as QualityIndicator)}>
                <SelectTrigger id="quality">
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
            </div>
          </div>

          {/* Criterion name */}
          <div className="space-y-2">
            <Label htmlFor="criterionName">Criterion Name *</Label>
            <Input
              id="criterionName"
              value={criterionName}
              onChange={(e) => setCriterionName(e.target.value)}
              placeholder="Enter criterion name"
            />
          </div>

          {/* Skills multi-select */}
          <div className="space-y-2">
            <Label>Skills *</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {facets.skillAreas.map(({ name }) => (
                  <label key={name} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={skillNames.includes(name)}
                      onCheckedChange={() => toggleSkill(name)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>
            {skillNames.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {skillNames.map(skill => (
                  <Badge key={skill} variant="outline" className="text-xs">
                    {skill}
                    <button onClick={() => toggleSkill(skill)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Categories multi-select */}
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {facets.categories.map(({ name }) => (
                  <label key={name} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={categories.includes(name)}
                      onCheckedChange={() => toggleCategory(name)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {categories.map(cat => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}
                    <button onClick={() => toggleCategory(cat)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Score fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="score3" className="text-green-700">
                Score 3 (Excellent)
              </Label>
              <Textarea
                id="score3"
                value={score3}
                onChange={(e) => setScore3(e.target.value)}
                rows={8}
                className="text-sm"
                placeholder="Describe excellent performance..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score2" className="text-blue-700">
                Score 2 (Good)
              </Label>
              <Textarea
                id="score2"
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                rows={8}
                className="text-sm"
                placeholder="Describe good performance..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score1" className="text-yellow-700">
                Score 1 (Acceptable)
              </Label>
              <Textarea
                id="score1"
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                rows={8}
                className="text-sm"
                placeholder="Describe acceptable performance..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score0" className="text-red-700">
                Score 0 (Below Standard)
              </Label>
              <Textarea
                id="score0"
                value={score0}
                onChange={(e) => setScore0(e.target.value)}
                rows={8}
                className="text-sm"
                placeholder="Describe below standard performance..."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Descriptor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
