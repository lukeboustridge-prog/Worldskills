"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { messageMySkillsAction } from "./actions";

interface SABroadcastMessageFormProps {
  skillCount: number;
}

export function SABroadcastMessageForm({ skillCount }: SABroadcastMessageFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await messageMySkillsAction(formData);
        formRef.current?.reset();
      }}
      className="space-y-4"
    >
      <Textarea
        name="body"
        placeholder="Share an important update with all your skill teams"
        rows={4}
        required
      />
      <Button type="submit">
        Send message to {skillCount} skill{skillCount === 1 ? "" : "s"}
      </Button>
    </form>
  );
}
