"use client";

import { useState, useTransition } from "react";
import { CPWVoteStatus } from "@prisma/client";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { submitVoteAction } from "../../vote/actions";

interface SkillWithVote {
  id: string;
  name: string;
  scmName: string;
  vote: {
    status: CPWVoteStatus;
    comment: string | null;
  } | null;
}

interface ProxyVoteListProps {
  sessionId: string;
  skills: SkillWithVote[];
}

export function ProxyVoteList({ sessionId, skills }: ProxyVoteListProps) {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillsState, setSkillsState] = useState(skills);

  const pendingSkills = skillsState.filter((s) => !s.vote);
  const votedSkills = skillsState.filter((s) => s.vote);

  return (
    <div className="space-y-6">
      {/* Pending Skills */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Pending ({pendingSkills.length})
        </h3>
        <div className="space-y-2">
          {pendingSkills.map((skill) => (
            <SkillVoteItem
              key={skill.id}
              skill={skill}
              sessionId={sessionId}
              isExpanded={expandedSkill === skill.id}
              onToggle={() =>
                setExpandedSkill(expandedSkill === skill.id ? null : skill.id)
              }
              onVoteComplete={(newVote) => {
                setSkillsState((prev) =>
                  prev.map((s) =>
                    s.id === skill.id ? { ...s, vote: newVote } : s
                  )
                );
                setExpandedSkill(null);
              }}
            />
          ))}
          {pendingSkills.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              All skills have been voted on
            </p>
          )}
        </div>
      </div>

      {/* Voted Skills */}
      {votedSkills.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Already Voted ({votedSkills.length})
          </h3>
          <div className="space-y-2">
            {votedSkills.map((skill) => (
              <SkillVoteItem
                key={skill.id}
                skill={skill}
                sessionId={sessionId}
                isExpanded={expandedSkill === skill.id}
                onToggle={() =>
                  setExpandedSkill(expandedSkill === skill.id ? null : skill.id)
                }
                onVoteComplete={(newVote) => {
                  setSkillsState((prev) =>
                    prev.map((s) =>
                      s.id === skill.id ? { ...s, vote: newVote } : s
                    )
                  );
                  setExpandedSkill(null);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillVoteItem({
  skill,
  sessionId,
  isExpanded,
  onToggle,
  onVoteComplete,
}: {
  skill: SkillWithVote;
  sessionId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onVoteComplete: (vote: { status: CPWVoteStatus; comment: string | null }) => void;
}) {
  const [comment, setComment] = useState(skill.vote?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleVote = (status: CPWVoteStatus) => {
    if (status === CPWVoteStatus.RED && !comment.trim()) {
      setError("Comment is required for red status");
      return;
    }

    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", sessionId);
      formData.set("skillId", skill.id);
      formData.set("status", status);
      if (comment.trim()) {
        formData.set("comment", comment.trim());
      }

      const result = await submitVoteAction(formData);

      if (result.error) {
        setError(result.error);
      } else {
        onVoteComplete({
          status,
          comment: status === CPWVoteStatus.RED ? comment.trim() : null,
        });
      }
    });
  };

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          {skill.vote ? (
            skill.vote.status === CPWVoteStatus.GREEN ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          )}
          <div>
            <p className="font-medium">{skill.name}</p>
            <p className="text-sm text-muted-foreground">SCM: {skill.scmName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {skill.vote && (
            <Badge
              variant="outline"
              className={
                skill.vote.status === CPWVoteStatus.GREEN
                  ? "border-green-500 text-green-600"
                  : "border-red-500 text-red-600"
              }
            >
              {skill.vote.status === CPWVoteStatus.GREEN ? "On Track" : "Issue"}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {skill.vote?.comment && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
              <strong>Current comment:</strong> {skill.vote.comment}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={() => handleVote(CPWVoteStatus.GREEN)}
              disabled={isPending}
              variant="outline"
              className="h-16 border-green-300 hover:bg-green-50 hover:border-green-500"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                  <span className="text-green-700">On Track</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={() => handleVote(CPWVoteStatus.RED)}
              disabled={isPending || !comment.trim()}
              variant="outline"
              className="h-16 border-red-300 hover:bg-red-50 hover:border-red-500"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <XCircle className="mr-2 h-5 w-5 text-red-500" />
                  <span className="text-red-700">Issue</span>
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter comment (required for red vote)"
              rows={2}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Comment is required for red votes
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
