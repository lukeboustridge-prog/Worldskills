"use client";

import { useRef, useState, useTransition } from "react";
import { File, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createMessageAction } from "./actions";
import { formatFileSize } from "@/lib/deliverables";

interface UploadedAttachment {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export function MessageForm({ skillId }: { skillId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
          throw new Error(data.error || "Upload failed");
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

  const handleSubmit = async (formData: FormData) => {
    if (attachments.length > 0) {
      formData.append("attachments", JSON.stringify(attachments));
    }

    startTransition(async () => {
      await createMessageAction(formData);
      formRef.current?.reset();
      setAttachments([]);
      setUploadError(null);
    });
  };

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <input type="hidden" name="skillId" value={skillId} />
      <Textarea
        name="body"
        placeholder="Share an update with your counterpart"
        rows={4}
        required
        disabled={isPending}
      />

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
        <Button type="submit" disabled={isPending || isUploading}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send message"
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
