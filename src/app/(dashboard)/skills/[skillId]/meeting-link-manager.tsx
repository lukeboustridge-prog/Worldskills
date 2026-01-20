"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMeetingLinkAction,
  removeMeetingLinkAction,
  type MeetingLink
} from "./meeting-actions";

interface MeetingLinkManagerProps {
  meetingId: string;
  skillId: string;
  links: MeetingLink[];
  canEdit: boolean;
}

export function MeetingLinkManager({
  meetingId,
  skillId,
  links,
  canEdit
}: MeetingLinkManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetNotices = () => {
    setError(null);
    setSuccess(null);
  };

  const handleAddLink = () => {
    resetNotices();

    if (!label.trim()) {
      setError("Please enter a label for the link.");
      return;
    }

    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }

    try {
      new URL(url);
    } catch {
      setError("Please enter a valid URL (e.g., https://example.com).");
      return;
    }

    startTransition(async () => {
      try {
        await addMeetingLinkAction(meetingId, { label: label.trim(), url: url.trim() }, skillId);
        setLabel("");
        setUrl("");
        setShowForm(false);
        setSuccess("Link added successfully.");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to add link.");
      }
    });
  };

  const handleRemoveLink = (linkId: string) => {
    if (!window.confirm("Remove this link from the meeting?")) {
      return;
    }

    resetNotices();

    startTransition(async () => {
      try {
        await removeMeetingLinkAction(meetingId, linkId, skillId);
        setSuccess("Link removed.");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to remove link.");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Links</p>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links added yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline truncate block"
                    >
                      {link.label}
                    </a>
                    <p className="text-xs text-muted-foreground truncate">
                      Added {format(new Date(link.addedAt), "d MMM yyyy")}
                    </p>
                  </div>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLink(link.id)}
                    disabled={isPending}
                    aria-label="Remove link"
                    className="ml-2 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit ? (
        <div>
          {showForm ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-2">
                <Label htmlFor="link-label">Label</Label>
                <Input
                  id="link-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Meeting recording"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={isPending}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddLink}
                  disabled={isPending}
                >
                  {isPending ? "Adding..." : "Add Link"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setLabel("");
                    setUrl("");
                    resetNotices();
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              disabled={isPending}
            >
              Add Link
            </Button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive" aria-live="polite">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600" aria-live="polite">{success}</p> : null}
    </div>
  );
}
