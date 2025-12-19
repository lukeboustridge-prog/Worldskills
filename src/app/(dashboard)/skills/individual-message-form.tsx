"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createMessageAction } from "./[skillId]/actions";

export function IndividualMessageForm({ skillId }: { skillId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createMessageAction(formData);
        formRef.current?.reset();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="skillId" value={skillId} />
      <Textarea
        name="body"
        placeholder="Share an update with your counterpart"
        rows={3}
        required
      />
      <Button type="submit" size="sm">
        Post message
      </Button>
    </form>
  );
}
