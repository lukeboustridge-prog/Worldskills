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

export type MeetingAttendeeData = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

export type MeetingGuestData = {
  id: string;
  name: string;
  email: string;
};

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
  attendees: MeetingAttendeeData[];
  guests: MeetingGuestData[];
};

export type TeamMemberOption = {
  id: string;
  name: string | null;
  email: string;
  role: "SA" | "SCM" | "Team";
};

interface MeetingListProps {
  meetings: MeetingData[];
  skillId: string;
  canManage: boolean;
  teamMembers: TeamMemberOption[];
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

              {(meeting.attendees.length > 0 || meeting.guests.length > 0) ? (
                <div className="mb-4 border-t pt-4">
                  {meeting.attendees.length > 0 ? (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Team members invited</p>
                      <ul className="space-y-1">
                        {meeting.attendees.map((attendee) => (
                          <li key={attendee.id} className="text-sm flex items-center gap-2">
                            <span>{attendee.name ?? attendee.email}</span>
                            <Badge variant="outline" className="text-xs">{attendee.role}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {meeting.guests.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">External guests</p>
                      <ul className="space-y-1">
                        {meeting.guests.map((guest) => (
                          <li key={guest.id} className="text-sm">
                            {guest.name} ({guest.email})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

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

interface PendingGuest {
  id: string;
  name: string;
  email: string;
}

const MIME_EXTENSION_FALLBACKS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
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

function ScheduleMeetingForm({ skillId, teamMembers }: { skillId: string; teamMembers: TeamMemberOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attendee and guest state
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(
    () => teamMembers.map((m) => m.id)
  );
  const [pendingGuests, setPendingGuests] = useState<PendingGuest[]>([]);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

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
  const [guestError, setGuestError] = useState<string | null>(null);

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

  const handleToggleAttendee = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddGuest = () => {
    setGuestError(null);

    if (!guestName.trim()) {
      setGuestError("Please enter a name for the guest.");
      return;
    }

    if (!guestEmail.trim()) {
      setGuestError("Please enter an email address.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      setGuestError("Please enter a valid email address.");
      return;
    }

    const newGuest: PendingGuest = {
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: guestName.trim(),
      email: guestEmail.trim().toLowerCase()
    };

    setPendingGuests((prev) => [...prev, newGuest]);
    setGuestName("");
    setGuestEmail("");
    setShowGuestForm(false);
  };

  const handleRemoveGuest = (id: string) => {
    setPendingGuests((prev) => prev.filter((guest) => guest.id !== id));
  };

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
        setAttachmentError("That file type isn't supported. Upload a PDF, Word, Excel, CSV, or image file.");
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
    const dateValue = formData.get("date") as string;
    const startTimeValue = formData.get("startTime") as string;
    const durationMinutes = parseInt(formData.get("duration") as string, 10);

    // Combine date and time into a datetime string
    const startTimeLocal = `${dateValue}T${startTimeValue}`;
    const startDate = new Date(startTimeLocal);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const newFormData = new FormData();
    newFormData.set("skillId", formData.get("skillId") as string);
    newFormData.set("title", formData.get("title") as string);
    newFormData.set("startTime", startDate.toISOString());
    newFormData.set("endTime", endDate.toISOString());
    newFormData.set("meetingLink", formData.get("meetingLink") as string);

    // Add attendees and guests
    newFormData.set("attendeeIds", JSON.stringify(selectedAttendees));
    if (pendingGuests.length > 0) {
      newFormData.set(
        "guests",
        JSON.stringify(pendingGuests.map((guest) => ({ name: guest.name, email: guest.email })))
      );
    }

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
      setSelectedAttendees(teamMembers.map((m) => m.id));
      setPendingGuests([]);
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
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="meeting-date">Date</Label>
              <Input
                id="meeting-date"
                name="date"
                type="date"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-start-time">Start Time</Label>
              <Input
                id="meeting-start-time"
                name="startTime"
                type="time"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-duration">Duration</Label>
              <select
                id="meeting-duration"
                name="duration"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue="60"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
                <option value="240">4 hours</option>
              </select>
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

          {/* Team Member Selection */}
          {teamMembers.length > 0 ? (
            <div className="space-y-2">
              <Label>Invite team members</Label>
              <div className="rounded-md border p-4 space-y-2 max-h-48 overflow-y-auto">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`attendee-${member.id}`}
                      checked={selectedAttendees.includes(member.id)}
                      onChange={() => handleToggleAttendee(member.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor={`attendee-${member.id}`} className="font-normal flex-1 flex items-center gap-2">
                      <span>{member.name ?? member.email}</span>
                      <Badge variant="outline" className="text-xs">{member.role}</Badge>
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected members will receive email invitations.
              </p>
            </div>
          ) : null}

          {/* External Guests */}
          <div className="space-y-2">
            <Label>Invite external guests (optional)</Label>
            <div className="rounded-md border p-4 space-y-3">
              {pendingGuests.length > 0 ? (
                <ul className="space-y-1">
                  {pendingGuests.map((guest) => (
                    <li key={guest.id} className="flex items-center justify-between text-sm">
                      <span>{guest.name} ({guest.email})</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveGuest(guest.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No external guests added.</p>
              )}
              {showGuestForm ? (
                <div className="space-y-2 rounded border p-2">
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Guest name"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="guest@example.com"
                    type="email"
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={handleAddGuest}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowGuestForm(false);
                        setGuestName("");
                        setGuestEmail("");
                        setGuestError(null);
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
                  onClick={() => setShowGuestForm(true)}
                >
                  Add Guest
                </Button>
              )}
              {guestError ? (
                <p className="text-sm text-destructive">{guestError}</p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              External guests receive email invitations but don&apos;t need system access.
            </p>
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

export function MeetingList({ meetings, skillId, canManage, teamMembers }: MeetingListProps) {
  const now = new Date();

  const upcomingMeetings = meetings
    .filter((m) => new Date(m.startTimeISO) >= now)
    .sort((a, b) => new Date(a.startTimeISO).getTime() - new Date(b.startTimeISO).getTime());

  const pastMeetings = meetings
    .filter((m) => new Date(m.startTimeISO) < now)
    .sort((a, b) => new Date(b.startTimeISO).getTime() - new Date(a.startTimeISO).getTime());

  return (
    <div className="space-y-6">
      {canManage ? <ScheduleMeetingForm skillId={skillId} teamMembers={teamMembers} /> : null}

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
