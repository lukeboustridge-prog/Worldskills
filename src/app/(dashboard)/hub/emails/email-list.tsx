"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Mail, Paperclip, ChevronLeft, ChevronRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmailDetail } from "./email-detail";

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface EmailListProps {
  emails: Email[];
  pagination: Pagination;
  type: "SKILL_BROADCAST" | "INTERNAL";
  onPageChange: (page: number) => void;
  currentUserId: string;
}

export function EmailList({
  emails,
  pagination,
  type,
  onPageChange,
  currentUserId,
}: EmailListProps) {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {type === "SKILL_BROADCAST"
                ? "No skill emails yet. Send your first email to skills."
                : "No internal emails yet. Start a conversation with your team."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedEmail) {
    return (
      <EmailDetail
        email={selectedEmail}
        onBack={() => setSelectedEmail(null)}
        currentUserId={currentUserId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {type === "SKILL_BROADCAST" ? "Skill Emails" : "Internal Emails"}
          </CardTitle>
          <CardDescription>
            {type === "SKILL_BROADCAST"
              ? "Emails sent to skill participants"
              : "Internal communication between SA and Secretariat"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {emails.map((email) => {
              const isSender = email.sender.id === currentUserId;
              const recipientPreview =
                type === "SKILL_BROADCAST"
                  ? email.skills.length > 0
                    ? email.skills.map((s) => s.skill.name).slice(0, 2).join(", ") +
                      (email.skills.length > 2 ? ` +${email.skills.length - 2} more` : "")
                    : `${email.recipients.length} recipients`
                  : email.recipients.length > 2
                    ? `${email.recipients.slice(0, 2).map((r) => r.recipientName ?? r.recipientEmail).join(", ")} +${email.recipients.length - 2} more`
                    : email.recipients.map((r) => r.recipientName ?? r.recipientEmail).join(", ");

              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {isSender ? `To: ${recipientPreview}` : `From: ${email.sender.name ?? email.sender.email}`}
                        </span>
                        {isSender && (
                          <Badge variant="outline" className="text-xs">
                            Sent
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm truncate">{email.subject}</p>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {email.body.slice(0, 100)}
                        {email.body.length > 100 ? "..." : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(email.createdAt), "MMM d, yyyy")}
                      </span>
                      <div className="flex items-center gap-2">
                        {email.attachments.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            {email.attachments.length}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {email.recipients.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} emails
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
