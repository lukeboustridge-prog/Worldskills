"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploader, type UploadedAttachment } from "./attachment-uploader";
import { sendSkillEmailAction } from "./actions";

interface Skill {
  id: string;
  name: string;
  sector: string | null;
}

interface SkillEmailFormProps {
  skills: Skill[];
  onSuccess: () => void;
}

export function SkillEmailForm({ skills, onSuccess }: SkillEmailFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedSkills(new Set(skills.map((s) => s.id)));
    } else {
      setSelectedSkills(new Set());
    }
  };

  const handleSkillToggle = (skillId: string) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(skillId)) {
      newSelected.delete(skillId);
    } else {
      newSelected.add(skillId);
    }
    setSelectedSkills(newSelected);
    setSelectAll(newSelected.size === skills.length);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedSkills.size === 0) {
      setError("Select at least one skill");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("skillIds", JSON.stringify(Array.from(selectedSkills)));
        formData.set("subject", subject);
        formData.set("body", body);
        formData.set("attachments", JSON.stringify(attachments));

        const result = await sendSkillEmailAction(formData);

        if (result.success) {
          onSuccess();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send email");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label>Select Skills</Label>
        <div className="rounded-md border p-4 max-h-48 overflow-y-auto space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={(checked) => handleSelectAll(checked === true)}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Select All ({skills.length})
            </label>
          </div>
          {skills.map((skill) => (
            <div key={skill.id} className="flex items-center space-x-2">
              <Checkbox
                id={`skill-${skill.id}`}
                checked={selectedSkills.has(skill.id)}
                onCheckedChange={() => handleSkillToggle(skill.id)}
              />
              <label
                htmlFor={`skill-${skill.id}`}
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {skill.name}
                {skill.sector && (
                  <span className="text-muted-foreground ml-2">({skill.sector})</span>
                )}
              </label>
            </div>
          ))}
          {skills.length === 0 && (
            <p className="text-sm text-muted-foreground">No skills available</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedSkills.size} skill{selectedSkills.size !== 1 ? "s" : ""} selected
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-subject">Subject</Label>
        <Input
          id="skill-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-body">Message</Label>
        <Textarea
          id="skill-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Enter your message"
          required
          rows={6}
        />
      </div>

      <AttachmentUploader
        attachments={attachments}
        onAttachmentsChange={setAttachments}
      />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send to {selectedSkills.size} Skill{selectedSkills.size !== 1 ? "s" : ""}
        </Button>
      </div>
    </form>
  );
}
