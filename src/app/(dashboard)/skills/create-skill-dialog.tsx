"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createSkillAction } from "./actions";
import { SkillCatalogField } from "./skill-catalog-field";

interface SelectOption {
  id: string;
  label: string;
}

interface CreateSkillDialogProps {
  advisors: SelectOption[];
  managers: SelectOption[];
  canCreate: boolean;
  disableReason?: string;
  defaultAdvisorId: string;
  isAdmin: boolean;
  usedSkillIds: string[];
}

export function CreateSkillDialog({
  advisors,
  managers,
  canCreate,
  disableReason,
  defaultAdvisorId,
  isAdmin,
  usedSkillIds
}: CreateSkillDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await createSkillAction(formData);
        setError(null);
        setIsOpen(false);
        setFormKey((value) => value + 1);
      } catch (submissionError) {
        if (submissionError instanceof Error) {
          setError(submissionError.message);
        } else {
          setError("Failed to create skill. Please try again.");
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
    <div className="flex flex-col items-end gap-2">
      <Button onClick={() => setIsOpen(true)} disabled={!canCreate}>
        Create skill
      </Button>
      {!canCreate && disableReason ? (
        <p className="text-xs text-destructive">{disableReason}</p>
      ) : null}
      {!canCreate && !isAdmin ? (
        <p className="text-xs text-muted-foreground">Please contact an admin to update the competition settings.</p>
      ) : null}
      {!canCreate && isAdmin ? (
        <Button asChild size="sm" variant="outline">
          <Link href="/settings">Open competition settings</Link>
        </Button>
      ) : null}
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-2xl rounded-lg bg-background p-6 shadow-xl"
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
            <h2 className="text-xl font-semibold">Create skill</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a WorldSkills option, assign a Skill Advisor, and optionally add a Skill Competition Manager.
            </p>
            {error ? (
              <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <form
              key={formKey}
              onSubmit={handleSubmit}
              className="mt-6 grid gap-4 md:grid-cols-2"
            >
              <SkillCatalogField disabled={isPending} usedSkillIds={usedSkillIds} />
              <div className="space-y-2">
                <Label htmlFor="saId">Skill Advisor</Label>
                <select
                  id="saId"
                  name="saId"
                  defaultValue={defaultAdvisorId}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isPending}
                  required
                >
                  <option value="" disabled>
                    Select Skill Advisor
                  </option>
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scmId">Skill Competition Manager</Label>
                <select
                  id="scmId"
                  name="scmId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isPending}
                >
                  <option value="">Unassigned</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Key competition preparation notes"
                  rows={4}
                  disabled={isPending}
                />
              </div>
              <div className="flex items-center justify-end gap-2 md:col-span-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create skill"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
