"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Download, File, Loader2, Users, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/deliverables";

interface EmailAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface EmailRecipient {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  recipientRole: string | null;
}

interface EmailSkill {
  skill: {
    id: string;
    name: string;
  };
}

interface Email {
  id: string;
  type: string;
  subject: string;
  body: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  recipients: EmailRecipient[];
  attachments: EmailAttachment[];
  skills: EmailSkill[];
}

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  currentUserId: string;
}

export function EmailDetail({ email, onBack, currentUserId }: EmailDetailProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isSender = email.sender.id === currentUserId;

  const handleDownload = async (attachment: EmailAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const res = await fetch(`/api/emails/attachments/${attachment.id}`);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="mt-4">
          <CardTitle className="text-xl">{email.subject}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            <span>
              {isSender ? "Sent by you" : `From: ${email.sender.name ?? email.sender.email}`}
            </span>
            <span>|</span>
            <span>{format(new Date(email.createdAt), "MMMM d, yyyy 'at' h:mm a")}</span>
            {email.type === "SKILL_BROADCAST" && (
              <>
                <span>|</span>
                <Badge variant="default">Skill Broadcast</Badge>
              </>
            )}
            {email.type === "INTERNAL" && (
              <>
                <span>|</span>
                <Badge variant="default">Internal</Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recipients Section */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Users className="h-4 w-4" />
            Recipients ({email.recipients.length})
          </div>
          {email.type === "SKILL_BROADCAST" && email.skills.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">Skills:</p>
              <div className="flex flex-wrap gap-1">
                {email.skills.map((s) => (
                  <Badge key={s.skill.id} variant="outline" className="text-xs">
                    {s.skill.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-md border p-3 max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {email.recipients.map((recipient) => (
                <div
                  key={recipient.id}
                  className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
                >
                  <Mail className="h-3 w-3" />
                  <span>{recipient.recipientName ?? recipient.recipientEmail}</span>
                  {recipient.recipientRole && (
                    <Badge variant="default" className="text-xs ml-1">
                      {recipient.recipientRole}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Message Body */}
        <div>
          <p className="text-sm font-medium mb-2">Message</p>
          <div className="rounded-md border p-4 bg-muted/30">
            <p className="whitespace-pre-wrap text-sm">{email.body}</p>
          </div>
        </div>

        {/* Attachments */}
        {email.attachments.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">
              Attachments ({email.attachments.length})
            </p>
            <div className="space-y-2">
              {email.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <File className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
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
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
