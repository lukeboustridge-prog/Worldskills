"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { messageAllSkillsAction } from "./actions";

export function BroadcastMessageForm() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await messageAllSkillsAction(formData);
        formRef.current?.reset();
      }}
      className="space-y-4"
    >
      <Textarea
        name="body"
        placeholder="Share an important update with every skill team"
        rows={4}
        required
      />
      <Button type="submit">Send message to all skills</Button>
    </form>
  );
}
