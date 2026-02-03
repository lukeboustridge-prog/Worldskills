"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, File, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/deliverables";

interface MessageAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface Message {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  attachments: MessageAttachment[];
}

interface MessageListProps {
  messages: Message[];
}

function getDisplayName(user: { name: string | null; email: string }): string {
  return user.name ?? user.email;
}

export function MessageList({ messages }: MessageListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (attachment: MessageAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const res = await fetch(`/api/messages/attachments/${attachment.id}`);
      if (!res.ok) {
        throw new Error("Failed to get download URL");
      }
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Download failed", err);
    } finally {
      setDownloadingId(null);
    }
  };

  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {getDisplayName(message.author)}
            </p>
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.createdAt), "dd MMM yyyy HH:mm")}
            </span>
          </div>
          <p className="mt-2 text-sm whitespace-pre-line">{message.body}</p>

          {/* Attachments */}
          {message.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span>{message.attachments.length} attachment{message.attachments.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-1">
                {message.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
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
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(attachment)}
                      disabled={downloadingId === attachment.id}
                    >
                      {downloadingId === attachment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
