"use client";

import { useState, useTransition } from "react";
import { CPWVoteStatus } from "@prisma/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitVoteAction } from "./actions";

interface VoteFormProps {
  sessionId: string;
  skillId: string;
  existingVote: {
    status: CPWVoteStatus;
    comment: string | null;
  } | null;
}

export function VoteForm({ sessionId, skillId, existingVote }: VoteFormProps) {
  const [selectedStatus, setSelectedStatus] = useState<CPWVoteStatus | null>(
    existingVote?.status ?? null
  );
  const [comment, setComment] = useState(existingVote?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleVote = (status: CPWVoteStatus) => {
    setSelectedStatus(status);
    setError(null);
    setSuccess(false);

    // If green, submit immediately
    if (status === CPWVoteStatus.GREEN) {
      submitVote(status, "");
    }
  };

  const submitVote = (status: CPWVoteStatus, voteComment: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", sessionId);
      formData.set("skillId", skillId);
      formData.set("status", status);
      if (voteComment) {
        formData.set("comment", voteComment);
      }

      const result = await submitVoteAction(formData);

      if (result.error) {
        setError(result.error);
        setSuccess(false);
      } else {
        setSuccess(true);
        setError(null);
      }
    });
  };

  const handleRedSubmit = () => {
    if (!comment.trim()) {
      setError("Please provide an explanation for the red status");
      return;
    }
    submitVote(CPWVoteStatus.RED, comment);
  };

  return (
    <div className="space-y-6">
      {/* Vote Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleVote(CPWVoteStatus.GREEN)}
          disabled={isPending}
          className={`
            relative flex flex-col items-center justify-center rounded-xl border-2 p-6 transition-all
            ${selectedStatus === CPWVoteStatus.GREEN
              ? "border-green-500 bg-green-50 dark:bg-green-950"
              : "border-border hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-950/50"
            }
            ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          <CheckCircle2
            className={`h-16 w-16 ${
              selectedStatus === CPWVoteStatus.GREEN
                ? "text-green-500"
                : "text-green-400"
            }`}
          />
          <span className="mt-3 text-lg font-semibold text-green-700 dark:text-green-400">
            On Track
          </span>
          {selectedStatus === CPWVoteStatus.GREEN && success && (
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleVote(CPWVoteStatus.RED)}
          disabled={isPending}
          className={`
            relative flex flex-col items-center justify-center rounded-xl border-2 p-6 transition-all
            ${selectedStatus === CPWVoteStatus.RED
              ? "border-red-500 bg-red-50 dark:bg-red-950"
              : "border-border hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/50"
            }
            ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          <XCircle
            className={`h-16 w-16 ${
              selectedStatus === CPWVoteStatus.RED
                ? "text-red-500"
                : "text-red-400"
            }`}
          />
          <span className="mt-3 text-lg font-semibold text-red-700 dark:text-red-400">
            Issue
          </span>
          {selectedStatus === CPWVoteStatus.RED && success && (
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          )}
        </button>
      </div>

      {/* Comment Field (shown when RED is selected) */}
      {selectedStatus === CPWVoteStatus.RED && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-base">
              What is the issue? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Please describe the issue with this skill's progress..."
              rows={4}
              className="resize-none"
              disabled={isPending}
            />
          </div>
          <Button
            onClick={handleRedSubmit}
            disabled={isPending || !comment.trim()}
            className="w-full bg-red-600 hover:bg-red-700"
            size="lg"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Red Vote"
            )}
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-lg bg-green-100 p-3 text-center text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
          Vote submitted successfully!
        </div>
      )}

      {/* Loading Indicator */}
      {isPending && selectedStatus === CPWVoteStatus.GREEN && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Submitting vote...</span>
        </div>
      )}
    </div>
  );
}
