"use client";

import { FormEvent, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { updateSkillAction } from "./actions";

interface SelectOption {
  id: string;
  label: string;
}

interface EditSkillDialogProps {
  skillId: string;
  skillName: string;
  currentSaId: string;
  advisors: SelectOption[];
}

export function EditSkillDialog({
  skillId,
  skillName,
  currentSaId,
  advisors
}: EditSkillDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await updateSkillAction(formData);
        setError(null);
        setIsOpen(false);
      } catch (submissionError) {
        if (submissionError instanceof Error) {
          setError(submissionError.message);
        } else {
          setError("Failed to update skill. Please try again.");
        }
      }
    });
  };

  const closeDialog = () => {
    if (!isPending) {
      setIsOpen(false);
      setError(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        title="Reassign Skill Advisor"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDialog}
              className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-semibold">Reassign Skill</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Change the Skill Advisor for <strong>{skillName}</strong>
            </p>
            {error ? (
              <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input type="hidden" name="skillId" value={skillId} />
              <div className="space-y-2">
                <Label htmlFor="saId">Skill Advisor</Label>
                <select
                  id="saId"
                  name="saId"
                  defaultValue={currentSaId}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isPending}
                  required
                >
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
