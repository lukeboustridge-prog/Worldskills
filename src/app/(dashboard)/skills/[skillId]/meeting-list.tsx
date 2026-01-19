"use client";

import { useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteMeetingAction,
  scheduleMeetingAction,
  updateMeetingMinutesAction
} from "./meeting-actions";

export type MeetingData = {
  id: string;
  title: string;
  startTimeISO: string;
  endTimeISO: string;
  meetingLink: string | null;
  minutes: string | null;
  actionPoints: string | null;
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
              {canManage ? (
                <div className="flex gap-2">
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

function ScheduleMeetingForm({ skillId }: { skillId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const startTimeLocal = formData.get("startTimeLocal") as string;
    const endTimeLocal = formData.get("endTimeLocal") as string;

    const newFormData = new FormData();
    newFormData.set("skillId", formData.get("skillId") as string);
    newFormData.set("title", formData.get("title") as string);
    newFormData.set("startTime", toUTCISOString(startTimeLocal));
    newFormData.set("endTime", toUTCISOString(endTimeLocal));
    newFormData.set("meetingLink", formData.get("meetingLink") as string);

    startTransition(async () => {
      await scheduleMeetingAction(newFormData);
      formRef.current?.reset();
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
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
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
