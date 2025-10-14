"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { updateSkillAction } from "./actions";

type Option = {
  id: string;
  label: string;
};

interface SkillAssignmentFormProps {
  skillId: string;
  defaultSaId: string | null;
  defaultScmId: string | null;
  advisorOptions: Option[];
  managerOptions: Option[];
  workspaceHref: string;
  isUnassigned?: boolean;
}

export function SkillAssignmentForm({
  skillId,
  defaultSaId,
  defaultScmId,
  advisorOptions,
  managerOptions,
  workspaceHref,
  isUnassigned = false
}: SkillAssignmentFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saId, setSaId] = useState(defaultSaId ?? "");
  const [scmId, setScmId] = useState(defaultScmId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSaId(defaultSaId ?? "");
    setScmId(defaultScmId ?? "");
  }, [defaultSaId, defaultScmId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!saId) {
      setError("Select a Skill Advisor before saving.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("skillId", skillId);
    formData.append("saId", saId);
    formData.append("scmId", scmId);

    startTransition(async () => {
      try {
        await updateSkillAction(formData);
        setIsEditing(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to save changes");
      }
    });
  };

  const handleCancel = () => {
    setSaId(defaultSaId ?? "");
    setScmId(defaultScmId ?? "");
    setError(null);
    setIsEditing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="skillId" value={skillId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`sa-${skillId}`} className="whitespace-nowrap">
            Skill Advisor
          </Label>
          <select
            id={`sa-${skillId}`}
            name="saId"
            value={saId}
            onChange={(event) => {
              setSaId(event.target.value);
              setError(null);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={!isEditing || isPending}
            required
          >
            <option value="" disabled>
              {isUnassigned ? "Select Skill Advisor" : "Choose Skill Advisor"}
            </option>
            {advisorOptions.map((advisor) => (
              <option key={advisor.id} value={advisor.id}>
                {advisor.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`scm-${skillId}`} className="whitespace-nowrap">
            Skill Competition Manager
          </Label>
          <select
            id={`scm-${skillId}`}
            name="scmId"
            value={scmId}
            onChange={(event) => {
              setScmId(event.target.value);
              setError(null);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={!isEditing || isPending}
          >
            <option value="">Unassigned</option>
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {isEditing ? (
          <>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setError(null);
              setIsEditing(true);
            }}
          >
            Edit details
          </Button>
        )}
        <Button asChild size="sm" variant="outline" disabled={isPending}>
          <Link href={workspaceHref}>Open workspace</Link>
        </Button>
      </div>
    </form>
  );
}
