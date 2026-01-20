"use client";

import { useRef, useState, useTransition, useCallback, useEffect } from "react";
import { ExternalLink, Trash2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  formatFileSize
} from "@/lib/deliverables";
import {
  deleteMeetingAction,
  scheduleMeetingAction,
  updateMeetingMinutesAction,
  type MeetingDocument,
  type MeetingLink
} from "./meeting-actions";
import { MeetingDocumentManager } from "./meeting-document-manager";
import { MeetingLinkManager } from "./meeting-link-manager";

export type MeetingData = {
  id: string;
  title: string;
  startTimeISO: string;
  endTimeISO: string;
  meetingLink: string | null;
  minutes: string | null;
  actionPoints: string | null;
  documents: MeetingDocument[];
  links: MeetingLink[];
};

interface MeetingListProps {
  meetings: MeetingData[];
  skillId: string;
  canManage: boolean;
}

function formatLocalDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLocalTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toUTCISOString(localDateTimeString: string): string {
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
}

function MeetingItem({
  meeting,
  skillId,
  canManage
}: {
  meeting: MeetingData;
  skillId: string;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const isPast = new Date(meeting.startTimeISO) < new Date();

  const handleUpdateMinutes = async (formData: FormData) => {
    startTransition(async () => {
      await updateMeetingMinutesAction(formData);
      setIsEditing(false);
    });
  };

  const handleDelete = async (formData: FormData) => {
    if (!confirm("Are you sure you want to delete this meeting?")) {
      return;
    }
    startTransition(async () => {
      await deleteMeetingAction(formData);
    });
  };

  return (
    <div className="rounded-md border">
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{meeting.title}</h4>
            {isPast ? (
              <Badge variant="outline" className="text-xs">Past</Badge>
            ) : (
              <Badge className="text-xs">Upcoming</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatLocalDateTime(meeting.startTimeISO)} - {formatLocalTime(meeting.endTimeISO)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {meeting.meetingLink && !isPast ? (
            <a
              href={meeting.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 underline hover:text-blue-800"
              onClick={(e) => e.stopPropagation()}
            >
              Join
            </a>
          ) : null}
          <span className="text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded ? (
        <div className="border-t px-4 py-4">
          {meeting.meetingLink ? (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground">Meeting Link</p>
              <a
                href={meeting.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline break-all"
              >
                {meeting.meetingLink}
              </a>
            </div>
          ) : null}

          {isEditing && canManage ? (
            <form ref={formRef} action={handleUpdateMinutes} className="space-y-4">
              <input type="hidden" name="meetingId" value={meeting.id} />
              <input type="hidden" name="skillId" value={skillId} />
              <div className="space-y-2">
                <Label htmlFor={`minutes-${meeting.id}`}>Minutes</Label>
                <Textarea
                  id={`minutes-${meeting.id}`}
                  name="minutes"
                  defaultValue={meeting.minutes ?? ""}
                  rows={4}
                  placeholder="Record meeting minutes here..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`actionPoints-${meeting.id}`}>Action Points</Label>
                <Textarea
                  id={`actionPoints-${meeting.id}`}
                  name="actionPoints"
                  defaultValue={meeting.actionPoints ?? ""}
                  rows={4}
                  placeholder="List action items here..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground">Minutes</p>
                <p className="mt-1 text-sm whitespace-pre-line">
                  {meeting.minutes || "No minutes recorded yet."}
                </p>
              </div>
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground">Action Points</p>
                <p className="mt-1 text-sm whitespace-pre-line">
                  {meeting.actionPoints || "No action points recorded yet."}
                </p>
              </div>

              <div className="mb-4 border-t pt-4">
                <MeetingLinkManager
                  meetingId={meeting.id}
                  skillId={skillId}
                  links={meeting.links}
                  canEdit={canManage}
                />
              </div>

              <div className="mb-4 border-t pt-4">
                <MeetingDocumentManager
                  meetingId={meeting.id}
                  skillId={skillId}
                  documents={meeting.documents}
                  canEdit={canManage}
                />
              </div>

              {canManage ? (
                <div className="flex gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Minutes
                  </Button>
                  <form action={handleDelete} className="inline">
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <input type="hidden" name="skillId" value={skillId} />
                    <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
                      Delete
                    </Button>
                  </form>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface PendingLink {
  id: string;
  label: string;
  url: string;
}

interface PendingDocument {
  id: string;
  fileName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
}

const MIME_EXTENSION_FALLBACKS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
};

function resolveMimeType(file: File) {
  if (file.type) {
    return file.type;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) {
    return "";
  }
  return MIME_EXTENSION_FALLBACKS[extension] ?? "";
}

function ScheduleMeetingForm({ skillId }: { skillId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment state
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageChecking, setStorageChecking] = useState(true);

  // Check storage health on mount
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function checkStorage() {
      try {
        const response = await fetch("/api/storage/health", {
          cache: "no-store",
          signal: controller.signal
        });
        if (cancelled) return;
        if (response.ok) {
          const data = await response.json();
          setStorageReady(data.ok === true);
        }
      } catch {
        // Ignore errors
      } finally {
        if (!cancelled) {
          setStorageChecking(false);
        }
      }
    }

    checkStorage();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen]);

  const handleAddLink = () => {
    setAttachmentError(null);

    if (!linkLabel.trim()) {
      setAttachmentError("Please enter a label for the link.");
      return;
    }

    if (!linkUrl.trim()) {
      setAttachmentError("Please enter a URL.");
      return;
    }

    try {
      new URL(linkUrl);
    } catch {
      setAttachmentError("Please enter a valid URL (e.g., https://example.com).");
      return;
    }

    const newLink: PendingLink = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label: linkLabel.trim(),
      url: linkUrl.trim()
    };

    setPendingLinks((prev) => [...prev, newLink]);
    setLinkLabel("");
    setLinkUrl("");
    setShowLinkForm(false);
  };

  const handleRemoveLink = (id: string) => {
    setPendingLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      setAttachmentError(null);

      const mimeType = resolveMimeType(file);
      if (!mimeType) {
        setAttachmentError("We couldn't determine the file type.");
        return;
      }

      if (!DOCUMENT_MIME_TYPES.includes(mimeType as (typeof DOCUMENT_MIME_TYPES)[number])) {
        setAttachmentError("That file type isn't supported. Upload a PDF, Word document, or image.");
        return;
      }

      if (file.size > DOCUMENT_MAX_BYTES) {
        setAttachmentError(
          `The file is larger than the ${formatFileSize(DOCUMENT_MAX_BYTES)} limit.`
        );
        return;
      }

      setIsUploading(true);

      try {
        // We need a temporary meeting ID for upload - use a placeholder approach
        // Actually, for pre-meeting uploads, we'll upload to a temporary location
        // and include the keys in the form submission
        const formData = new FormData();
        formData.set("skillId", skillId);
        formData.set("file", file);

        // Upload to a temporary endpoint - for now, we'll store the file info
        // and the actual upload will happen via the general upload route
        // Since we don't have a meeting ID yet, we need a different approach

        // For simplicity, we'll use the /api/upload endpoint which doesn't require a meeting ID
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(data.error || data.message || "Upload failed");
        }

        const result = await response.json();

        const newDoc: PendingDocument = {
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fileName: file.name,
          storageKey: result.key,
          fileSize: file.size,
          mimeType: mimeType
        };

        setPendingDocuments((prev) => [...prev, newDoc]);
      } catch (err) {
        setAttachmentError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [skillId]
  );

  const handleRemoveDocument = (id: string) => {
    setPendingDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const onFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      await handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleSubmit = async (formData: FormData) => {
    const startTimeLocal = formData.get("startTimeLocal") as string;
    const endTimeLocal = formData.get("endTimeLocal") as string;

    const newFormData = new FormData();
    newFormData.set("skillId", formData.get("skillId") as string);
    newFormData.set("title", formData.get("title") as string);
    newFormData.set("startTime", toUTCISOString(startTimeLocal));
    newFormData.set("endTime", toUTCISOString(endTimeLocal));
    newFormData.set("meetingLink", formData.get("meetingLink") as string);

    // Add initial links and documents
    if (pendingLinks.length > 0) {
      newFormData.set(
        "initialLinks",
        JSON.stringify(pendingLinks.map((link) => ({ label: link.label, url: link.url })))
      );
    }

    if (pendingDocuments.length > 0) {
      newFormData.set(
        "initialDocuments",
        JSON.stringify(
          pendingDocuments.map((doc) => ({
            storageKey: doc.storageKey,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType
          }))
        )
      );
    }

    startTransition(async () => {
      await scheduleMeetingAction(newFormData);
      formRef.current?.reset();
      setPendingLinks([]);
      setPendingDocuments([]);
      setIsOpen(false);
    });
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>Schedule Meeting</Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Schedule a Meeting</CardTitle>
        <CardDescription>
          Create a meeting and send calendar invites to the SA and SCM.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <input type="hidden" name="skillId" value={skillId} />
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              name="title"
              required
              placeholder="e.g., Weekly sync meeting"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meeting-start">Start Time</Label>
              <Input
                id="meeting-start"
                name="startTimeLocal"
                type="datetime-local"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-end">End Time</Label>
              <Input
                id="meeting-end"
                name="endTimeLocal"
                type="datetime-local"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meeting-link">Meeting Link (optional)</Label>
            <Input
              id="meeting-link"
              name="meetingLink"
              type="url"
              placeholder="https://meet.google.com/..."
            />
          </div>

          {/* Attachments Section */}
          <div className="space-y-4 rounded-md border p-4">
            <p className="text-sm font-medium">Attachments (optional)</p>

            {/* Links */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Links</p>
              {pendingLinks.length > 0 ? (
                <ul className="space-y-1">
                  {pendingLinks.map((link) => (
                    <li key={link.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{link.label}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLink(link.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No links added.</p>
              )}
              {showLinkForm ? (
                <div className="space-y-2 rounded border p-2">
                  <Input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Label"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={handleAddLink}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowLinkForm(false);
                        setLinkLabel("");
                        setLinkUrl("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLinkForm(true)}
                >
                  Add Link
                </Button>
              )}
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Documents</p>
              {pendingDocuments.length > 0 ? (
                <ul className="space-y-1">
                  {pendingDocuments.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="truncate block">{doc.fileName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDocument(doc.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No documents uploaded.</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || storageChecking || !storageReady}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Uploading...
                    </>
                  ) : storageChecking ? (
                    "Checking..."
                  ) : !storageReady ? (
                    "Storage unavailable"
                  ) : (
                    "Upload File"
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={DOCUMENT_MIME_TYPES.join(",")}
                  className="sr-only"
                  onChange={onFileSelected}
                  disabled={isUploading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                PDF, Word documents, JPEG, PNG · Max {formatFileSize(DOCUMENT_MAX_BYTES)}
              </p>
            </div>

            {attachmentError ? (
              <p className="text-sm text-destructive">{attachmentError}</p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || isUploading}>
              {isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setPendingLinks([]);
                setPendingDocuments([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function MeetingList({ meetings, skillId, canManage }: MeetingListProps) {
  const now = new Date();

  const upcomingMeetings = meetings
    .filter((m) => new Date(m.startTimeISO) >= now)
    .sort((a, b) => new Date(a.startTimeISO).getTime() - new Date(b.startTimeISO).getTime());

  const pastMeetings = meetings
    .filter((m) => new Date(m.startTimeISO) < now)
    .sort((a, b) => new Date(b.startTimeISO).getTime() - new Date(a.startTimeISO).getTime());

  return (
    <div className="space-y-6">
      {canManage ? <ScheduleMeetingForm skillId={skillId} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
          <CardDescription>Scheduled meetings for this skill.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming meetings scheduled.</p>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <MeetingItem
                  key={meeting.id}
                  meeting={meeting}
                  skillId={skillId}
                  canManage={canManage}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past Meetings</CardTitle>
          <CardDescription>Previous meetings and their minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          {pastMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past meetings recorded.</p>
          ) : (
            <div className="space-y-3">
              {pastMeetings.map((meeting) => (
                <MeetingItem
                  key={meeting.id}
                  meeting={meeting}
                  skillId={skillId}
                  canManage={canManage}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
