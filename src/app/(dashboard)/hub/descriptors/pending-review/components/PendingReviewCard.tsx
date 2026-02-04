"use client";

import { useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  X,
  Undo2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { approveDescriptorAction, returnDescriptorAction } from "../actions";
import type { PendingDescriptor } from "@/lib/sa-approval";

interface PendingReviewCardProps {
  descriptor: PendingDescriptor;
}

export function PendingReviewCard({ descriptor }: PendingReviewCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [processed, setProcessed] = useState(false);

  // Form state for editing
  const [criterionName, setCriterionName] = useState(descriptor.criterionName);
  const [score3, setScore3] = useState(descriptor.score3 || "");
  const [score2, setScore2] = useState(descriptor.score2 || "");
  const [score1, setScore1] = useState(descriptor.score1 || "");
  const [score0, setScore0] = useState(descriptor.score0 || "");

  // Return comment state
  const [returnComment, setReturnComment] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleApprove = () => {
    const formData = new FormData();
    formData.set("id", descriptor.id);

    // Include edits if in editing mode
    if (editing) {
      formData.set("criterionName", criterionName);
      formData.set("score3", score3);
      formData.set("score2", score2);
      formData.set("score1", score1);
      formData.set("score0", score0);
    }

    startTransition(async () => {
      const result = await approveDescriptorAction(formData);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        const message = result.wasModified
          ? "Descriptor approved with modifications"
          : "Descriptor approved";
        toast({ title: "Approved", description: message });
        setProcessed(true);
      }
    });
  };

  const handleReturn = () => {
    const formData = new FormData();
    formData.set("id", descriptor.id);
    formData.set("comment", returnComment);

    startTransition(async () => {
      const result = await returnDescriptorAction(formData);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Returned",
          description: "Descriptor returned to SCM with your feedback",
        });
        setDialogOpen(false);
        setProcessed(true);
      }
    });
  };

  const handleCancelEdit = () => {
    setCriterionName(descriptor.criterionName);
    setScore3(descriptor.score3 || "");
    setScore2(descriptor.score2 || "");
    setScore1(descriptor.score1 || "");
    setScore0(descriptor.score0 || "");
    setEditing(false);
  };

  // Don't render if already processed
  if (processed) {
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
                {descriptor.criterionName}
              </CardTitle>
            )}

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline">{descriptor.code}</Badge>
              {descriptor.wsosSection && (
                <Badge>{descriptor.wsosSection.name}</Badge>
              )}
              {descriptor.createdBy && (
                <>
                  <span>from</span>
                  <span className="font-medium">
                    {descriptor.createdBy.name || descriptor.createdBy.email}
                  </span>
                </>
              )}
              {descriptor.submittedAt && (
                <>
                  <span>submitted</span>
                  <span>
                    {new Date(descriptor.submittedAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpanded(true);
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button size="sm" onClick={handleApprove} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </>
                  )}
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Undo2 className="h-4 w-4 mr-1" />
                      Return
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Return Descriptor</DialogTitle>
                      <DialogDescription>
                        Return this descriptor to the SCM with feedback on what
                        needs to be changed.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="returnComment">Feedback for SCM</Label>
                        <Textarea
                          id="returnComment"
                          value={returnComment}
                          onChange={(e) => setReturnComment(e.target.value)}
                          placeholder="Please explain what needs to be revised..."
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        variant="destructive"
                        onClick={handleReturn}
                        disabled={isPending || returnComment.length < 5}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          "Return to SCM"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="ml-7 pt-3 border-t space-y-4">
            {editing ? (
              <>
                {/* Score fields for editing */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-green-700">Score 3 (Excellent)</Label>
                    <Textarea
                      value={score3}
                      onChange={(e) => setScore3(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-700">Score 2 (Good)</Label>
                    <Textarea
                      value={score2}
                      onChange={(e) => setScore2(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-yellow-700">Score 1 (Acceptable)</Label>
                    <Textarea
                      value={score1}
                      onChange={(e) => setScore1(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-red-700">Score 0 (Below Standard)</Label>
                    <Textarea
                      value={score0}
                      onChange={(e) => setScore0(e.target.value)}
                      rows={6}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleApprove} disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Approve with Changes
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-sm">
                {descriptor.score3 && (
                  <div>
                    <span className="font-medium text-green-700">Score 3:</span>{" "}
                    <span className="text-muted-foreground">
                      {descriptor.score3}
                    </span>
                  </div>
                )}
                {descriptor.score2 && (
                  <div>
                    <span className="font-medium text-blue-700">Score 2:</span>{" "}
                    <span className="text-muted-foreground">
                      {descriptor.score2}
                    </span>
                  </div>
                )}
                {descriptor.score1 && (
                  <div>
                    <span className="font-medium text-yellow-700">Score 1:</span>{" "}
                    <span className="text-muted-foreground">
                      {descriptor.score1}
                    </span>
                  </div>
                )}
                {descriptor.score0 && (
                  <div>
                    <span className="font-medium text-red-700">Score 0:</span>{" "}
                    <span className="text-muted-foreground">
                      {descriptor.score0}
                    </span>
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
