"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateSkillNotesAction } from "./actions";

interface SkillNotesProps {
  skillId: string;
  initialNotes: string | null;
}

export function SkillNotes({ skillId, initialNotes }: SkillNotesProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");

  const handleSave = () => {
    const formData = new FormData();
    formData.set("skillId", skillId);
    formData.set("notes", notes);

    startTransition(async () => {
      const result = await updateSkillNotesAction(formData);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Saved", description: "Notes updated successfully" });
        setEditing(false);
      }
    });
  };

  const handleCancel = () => {
    setNotes(initialNotes ?? "");
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>SA Notes</CardTitle>
            <CardDescription>
              Private notes visible only to the Skill Advisor and Secretariat.
              Use this to track important information about this skill.
            </CardDescription>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this skill..."
              rows={8}
              className="resize-none"
              maxLength={5000}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {notes.length}/5000 characters
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save Notes
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm">
            {notes ? (
              notes
            ) : (
              <p className="text-muted-foreground italic">No notes added yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
