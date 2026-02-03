"use client";

import { useRef, useState, useTransition } from "react";
import { File, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatFileSize } from "@/lib/deliverables";
import { sendSkillEmailWithRecipientsAction } from "./actions";

interface UploadedAttachment {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface SkillEmailFormProps {
  skillId: string;
  skillName: string;
  teamMembers: TeamMember[];
  currentUserId: string;
}

export function SkillEmailForm({ skillId, skillName, teamMembers, currentUserId }: SkillEmailFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Filter out current user from recipients
  const availableRecipients = teamMembers.filter((m) => m.id !== currentUserId);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(
    new Set(availableRecipients.map((m) => m.id))
  );
  const [selectAll, setSelectAll] = useState(true);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedRecipients(new Set(availableRecipients.map((m) => m.id)));
    } else {
      setSelectedRecipients(new Set());
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
    setSelectAll(newSelected.size === availableRecipients.length);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("skillId", skillId);

        const res = await fetch("/api/messages/attachments/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || data.error || "Upload failed");
        }

        const uploaded = await res.json();
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (selectedRecipients.size === 0) {
      setError("Select at least one recipient");
      return;
    }

    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }

    if (!body.trim()) {
      setError("Message is required");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("skillId", skillId);
        formData.set("recipientIds", JSON.stringify(Array.from(selectedRecipients)));
        formData.set("subject", subject);
        formData.set("body", body);
        formData.set("attachments", JSON.stringify(attachments));

        const result = await sendSkillEmailWithRecipientsAction(formData);

        if (result.success) {
          setSuccess(true);
          setSubject("");
          setBody("");
          setAttachments([]);
          formRef.current?.reset();
          // Reset to all recipients selected
          setSelectedRecipients(new Set(availableRecipients.map((m) => m.id)));
          setSelectAll(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send email");
      }
    });
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "SA":
        return "bg-blue-100 text-blue-800";
      case "SCM":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (availableRecipients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No other team members to send emails to.
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          Email sent successfully to {selectedRecipients.size} recipient{selectedRecipients.size !== 1 ? "s" : ""}.
        </div>
      )}

      <div className="space-y-2">
        <Label>Recipients</Label>
        <div className="rounded-md border p-3 max-h-40 overflow-y-auto space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              id="select-all-recipients"
              checked={selectAll}
              onCheckedChange={(checked) => handleSelectAll(checked === true)}
              disabled={isPending}
            />
            <label
              htmlFor="select-all-recipients"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Select All ({availableRecipients.length})
            </label>
          </div>
          {availableRecipients.map((member) => (
            <div key={member.id} className="flex items-center space-x-2">
              <Checkbox
                id={`recipient-${member.id}`}
                checked={selectedRecipients.has(member.id)}
                onCheckedChange={() => handleRecipientToggle(member.id)}
                disabled={isPending}
              />
              <label
                htmlFor={`recipient-${member.id}`}
                className="flex items-center gap-2 text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <span>{member.name ?? member.email}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeClass(member.role)}`}>
                  {member.role}
                </span>
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedRecipients.size} recipient{selectedRecipients.size !== 1 ? "s" : ""} selected
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-subject">Subject</Label>
        <Input
          id="email-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
          required
          maxLength={200}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-body">Message</Label>
        <Textarea
          id="email-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Enter your message"
          required
          rows={4}
          disabled={isPending}
        />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Attachments ({attachments.length})
          </p>
          <div className="space-y-1">
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.storageKey}-${index}`}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => removeAttachment(index)}
                  disabled={isPending}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || isUploading || selectedRecipients.size === 0}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            `Send to ${selectedRecipients.size} recipient${selectedRecipients.size !== 1 ? "s" : ""}`
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Paperclip className="mr-2 h-4 w-4" />
              Attach file
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
          multiple
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Supported: PDF, Word, Excel, PowerPoint, images. Max 25MB per file.
      </p>
    </form>
  );
}
