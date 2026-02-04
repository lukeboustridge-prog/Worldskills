"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useDebouncedCallback } from "use-debounce";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateWarning } from "@/components/wsos/duplicate-warning";
import type { SimilarSection, WSOSSectionWithCreator } from "@/lib/wsos-sections";
import { checkSimilarSectionsAction } from "./actions";

interface WSOSSectionFormProps {
  editingSection: WSOSSectionWithCreator | null | undefined;
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
}

export function WSOSSectionForm({
  editingSection,
  createAction,
  updateAction,
}: WSOSSectionFormProps) {
  const [name, setName] = useState(editingSection?.name ?? "");
  const [similar, setSimilar] = useState<SimilarSection[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  // Reset form when editingSection changes
  useEffect(() => {
    setName(editingSection?.name ?? "");
    setSimilar([]);
  }, [editingSection]);

  // Debounced duplicate check (500ms delay)
  const checkSimilar = useDebouncedCallback(async (value: string) => {
    if (value.length < 3) {
      setSimilar([]);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    try {
      // Exclude current section when editing
      const results = await checkSimilarSectionsAction(
        value,
        editingSection?.id
      );
      setSimilar(results);
    } catch (error) {
      console.error("Failed to check similar sections:", error);
      setSimilar([]);
    } finally {
      setIsChecking(false);
    }
  }, 500);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    checkSimilar(value);
  };

  const action = editingSection ? updateAction : createAction;

  return (
    <form action={action} className="space-y-4">
      {editingSection && (
        <input type="hidden" name="id" value={editingSection.id} />
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Section Name</Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={handleNameChange}
          placeholder="e.g., Work Organisation and Management"
        />
        {isChecking && (
          <p className="text-xs text-muted-foreground">
            Checking for similar sections...
          </p>
        )}
        <DuplicateWarning similar={similar} className="mt-2" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={editingSection?.description ?? ""}
          placeholder="Brief description of this WSOS section"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">
          <Plus className="mr-2 h-4 w-4" />
          {editingSection ? "Update Section" : "Create Section"}
        </Button>
        {editingSection && (
          <Button asChild variant="outline">
            <Link href="/settings/wsos-sections">Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
