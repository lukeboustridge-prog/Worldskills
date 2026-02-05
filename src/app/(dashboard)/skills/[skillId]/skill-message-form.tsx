"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createMessageAction } from "./actions";

interface SkillMessageFormProps {
  skillId: string;
  skillName: string;
}

export function SkillMessageForm({ skillId, skillName }: SkillMessageFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!body.trim()) {
      setError("Message is required");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("skillId", skillId);
        formData.set("body", body);
        formData.set("attachments", JSON.stringify([]));

        await createMessageAction(formData);

        setSuccess(true);
        setBody("");
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post message");
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          Message posted. Team members have been notified by email.
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          id="message-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Post a message for the ${skillName} team...`}
          required
          rows={4}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || !body.trim()}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Posting...
            </>
          ) : (
            "Post message"
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        All team members will receive an email notification when you post a message.
      </p>
    </form>
  );
}
