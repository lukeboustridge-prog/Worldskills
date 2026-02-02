"use client";

import { useState, useTransition } from "react";
import { QualityIndicator } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createDescriptorAction } from "../actions";
import type { Facets } from "@/lib/queries/facet-counts";

const QUALITY_OPTIONS: { value: QualityIndicator; label: string }[] = [
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "REFERENCE", label: "Reference" },
  { value: "GOOD", label: "Good" },
  { value: "EXCELLENT", label: "Excellent" },
];

const NO_CATEGORY = "__none__";

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
  const [skillName, setSkillName] = useState("");
  const [category, setCategory] = useState("");
  const [quality, setQuality] = useState<QualityIndicator>("NEEDS_REVIEW");

  const resetForm = () => {
    setCode("");
    setCriterionName("");
    setScore3("");
    setScore2("");
    setScore1("");
    setScore0("");
    setSkillName("");
    setCategory("");
    setQuality("NEEDS_REVIEW");
  };

  const handleCreate = () => {
    if (!code.trim() || !criterionName.trim() || !skillName) {
      toast({
        title: "Validation Error",
        description: "Code, criterion name, and skill are required",
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
    formData.set("skillName", skillName);
    formData.set("category", category);
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
          <div className="grid gap-4 md:grid-cols-3">
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
              <Label htmlFor="skill">Skill *</Label>
              <Select value={skillName} onValueChange={setSkillName}>
                <SelectTrigger id="skill">
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
              <Label htmlFor="category">Category</Label>
              <Select
                value={category || NO_CATEGORY}
                onValueChange={(v) => setCategory(v === NO_CATEGORY ? "" : v)}
              >
                <SelectTrigger id="category">
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

          {/* Criterion name and quality */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="criterionName">Criterion Name *</Label>
              <Input
                id="criterionName"
                value={criterionName}
                onChange={(e) => setCriterionName(e.target.value)}
                placeholder="Enter criterion name"
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
