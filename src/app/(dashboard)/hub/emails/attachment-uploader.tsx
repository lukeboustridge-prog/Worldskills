"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, File, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatFileSize } from "@/lib/deliverables";

export interface UploadedAttachment {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface AttachmentUploaderProps {
  attachments: UploadedAttachment[];
  onAttachmentsChange: (attachments: UploadedAttachment[]) => void;
  maxTotalBytes?: number;
}

const DEFAULT_MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25MB

export function AttachmentUploader({
  attachments,
  onAttachmentsChange,
  maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
}: AttachmentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = attachments.reduce((sum, a) => sum + a.fileSize, 0);
  const remainingBytes = maxTotalBytes - totalSize;

  const uploadFile = async (file: File): Promise<UploadedAttachment | null> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/emails/attachments/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Upload failed");
    }

    return res.json();
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      // Check total size
      const newFilesSize = fileArray.reduce((sum, f) => sum + f.size, 0);
      if (totalSize + newFilesSize > maxTotalBytes) {
        setError(`Total attachments cannot exceed ${formatFileSize(maxTotalBytes)}`);
        return;
      }

      setIsUploading(true);

      try {
        const uploaded: UploadedAttachment[] = [];

        for (const file of fileArray) {
          const result = await uploadFile(file);
          if (result) {
            uploaded.push(result);
          }
        }

        onAttachmentsChange([...attachments, ...uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [attachments, onAttachmentsChange, totalSize, maxTotalBytes]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    onAttachmentsChange(newAttachments);
  };

  return (
    <div className="space-y-2">
      <Label>Attachments</Label>

      {error && (
        <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors
          ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
          ${isUploading ? "pointer-events-none opacity-50" : ""}
        `}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
        />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        ) : (
          <div className="py-2">
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Drag and drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, Word, Excel, CSV, or images. Max {formatFileSize(maxTotalBytes)} total.
            </p>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={attachment.storageKey}
              className="flex items-center justify-between rounded-md border p-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.fileSize)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAttachment(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Total: {formatFileSize(totalSize)} / {formatFileSize(maxTotalBytes)}
            {remainingBytes < maxTotalBytes && (
              <span className="ml-2">({formatFileSize(remainingBytes)} remaining)</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
