"use client";

import { useState, useTransition, useMemo } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploader, type UploadedAttachment } from "./attachment-uploader";
import { sendInternalEmailAction } from "./actions";

interface Recipient {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface InternalEmailFormProps {
  recipients: Recipient[];
  onSuccess: () => void;
}

export function InternalEmailForm({ recipients, onSuccess }: InternalEmailFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  const { saUsers, secretariatUsers } = useMemo(() => {
    const sa = recipients.filter((r) => r.role === "SA");
    const secretariat = recipients.filter((r) => r.role === "Secretariat");
    return { saUsers: sa, secretariatUsers: secretariat };
  }, [recipients]);

  const allSAsSelected = saUsers.every((u) => selectedRecipients.has(u.id));
  const allSecretariatSelected = secretariatUsers.every((u) => selectedRecipients.has(u.id));
  const allSelected = recipients.every((u) => selectedRecipients.has(u.id));

  const handleSelectAllSAs = () => {
    const newSelected = new Set(selectedRecipients);
    if (allSAsSelected) {
      saUsers.forEach((u) => newSelected.delete(u.id));
    } else {
      saUsers.forEach((u) => newSelected.add(u.id));
    }
    setSelectedRecipients(newSelected);
  };

  const handleSelectAllSecretariat = () => {
    const newSelected = new Set(selectedRecipients);
    if (allSecretariatSelected) {
      secretariatUsers.forEach((u) => newSelected.delete(u.id));
    } else {
      secretariatUsers.forEach((u) => newSelected.add(u.id));
    }
    setSelectedRecipients(newSelected);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map((r) => r.id)));
    }
  };

  const handleRecipientToggle = (userId: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedRecipients(newSelected);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedRecipients.size === 0) {
      setError("Select at least one recipient");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("recipientUserIds", JSON.stringify(Array.from(selectedRecipients)));
        formData.set("subject", subject);
        formData.set("body", body);
        formData.set("attachments", JSON.stringify(attachments));

        const result = await sendInternalEmailAction(formData);

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
        <Label>Select Recipients</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            type="button"
            variant={allSAsSelected ? "default" : "outline"}
            size="sm"
            onClick={handleSelectAllSAs}
            disabled={saUsers.length === 0}
          >
            All SAs ({saUsers.length})
          </Button>
          <Button
            type="button"
            variant={allSecretariatSelected ? "default" : "outline"}
            size="sm"
            onClick={handleSelectAllSecretariat}
            disabled={secretariatUsers.length === 0}
          >
            All Secretariat ({secretariatUsers.length})
          </Button>
          <Button
            type="button"
            variant={allSelected ? "default" : "outline"}
            size="sm"
            onClick={handleSelectAll}
            disabled={recipients.length === 0}
          >
            Select All ({recipients.length})
          </Button>
        </div>
        <div className="rounded-md border p-4 max-h-48 overflow-y-auto space-y-3">
          {saUsers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Skill Advisors
              </p>
              <div className="space-y-2">
                {saUsers.map((recipient) => (
                  <div key={recipient.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`recipient-${recipient.id}`}
                      checked={selectedRecipients.has(recipient.id)}
                      onCheckedChange={() => handleRecipientToggle(recipient.id)}
                    />
                    <label
                      htmlFor={`recipient-${recipient.id}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {recipient.name ?? recipient.email}
                      <span className="text-muted-foreground ml-2">({recipient.email})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          {secretariatUsers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Secretariat
              </p>
              <div className="space-y-2">
                {secretariatUsers.map((recipient) => (
                  <div key={recipient.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`recipient-${recipient.id}`}
                      checked={selectedRecipients.has(recipient.id)}
                      onCheckedChange={() => handleRecipientToggle(recipient.id)}
                    />
                    <label
                      htmlFor={`recipient-${recipient.id}`}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {recipient.name ?? recipient.email}
                      <span className="text-muted-foreground ml-2">({recipient.email})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recipients.length === 0 && (
            <p className="text-sm text-muted-foreground">No recipients available</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedRecipients.size} recipient{selectedRecipients.size !== 1 ? "s" : ""} selected
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="internal-subject">Subject</Label>
        <Input
          id="internal-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internal-body">Message</Label>
        <Textarea
          id="internal-body"
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
          Send to {selectedRecipients.size} Recipient{selectedRecipients.size !== 1 ? "s" : ""}
        </Button>
      </div>
    </form>
  );
}
