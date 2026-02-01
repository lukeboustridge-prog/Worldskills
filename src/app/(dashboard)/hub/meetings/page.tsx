import { redirect } from "next/navigation";
import { format, isBefore } from "date-fns";
import { Calendar, Clock, Video, FileText, ExternalLink } from "lucide-react";
import { Role } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingCountdown } from "./meeting-countdown";

interface MeetingDocument {
  name: string;
  url: string;
}

interface MeetingLink {
  label: string;
  url: string;
}

export default async function MeetingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const skills = await prisma.skill.findMany({
    where:
      user.role === Role.SA
        ? { saId: user.id }
        : user.role === Role.SCM
          ? { scmId: user.id }
          : user.role === Role.SkillTeam
            ? { teamMembers: { some: { userId: user.id } } }
            : user.isAdmin || user.role === Role.Secretariat
              ? {}
              : { saId: user.id },
    select: { id: true },
  });

  const skillIds = skills.map((s) => s.id);

  const now = new Date();

  const meetings = skillIds.length
    ? await prisma.meeting.findMany({
        where: { skillId: { in: skillIds } },
        orderBy: { startTime: "asc" },
        include: { skill: { select: { name: true } } },
      })
    : [];

  const upcomingMeetings = meetings.filter((m) => !isBefore(m.endTime, now));
  const pastMeetings = meetings
    .filter((m) => isBefore(m.endTime, now))
    .reverse();

  const nextMeeting = upcomingMeetings[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Meetings & Events
        </h1>
        <p className="mt-2 text-muted-foreground">
          View and manage your skill-related meetings.
        </p>
      </div>

      {nextMeeting && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge className="mb-2">Next Up</Badge>
                <CardTitle className="text-xl">{nextMeeting.title}</CardTitle>
                <CardDescription className="mt-1">
                  {nextMeeting.skill?.name ?? 'Skill Advisor Meeting'}
                </CardDescription>
              </div>
              <MeetingCountdown targetDate={nextMeeting.startTime} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(nextMeeting.startTime, "EEEE, dd MMMM yyyy")}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {format(nextMeeting.startTime, "HH:mm")} -{" "}
                {format(nextMeeting.endTime, "HH:mm")}
              </div>
            </div>
            {nextMeeting.meetingLink && (
              <Button asChild className="mt-4">
                <a
                  href={nextMeeting.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Video className="mr-2 h-4 w-4" />
                  Join Meeting
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
            <CardDescription>
              Future meetings for your skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming meetings scheduled.
              </p>
            ) : (
              <ul className="space-y-3">
                {upcomingMeetings.map((meeting) => {
                  const links = (meeting.links as unknown as MeetingLink[]) ?? [];
                  return (
                    <li
                      key={meeting.id}
                      className="rounded-md border p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{meeting.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {meeting.skill?.name ?? 'Skill Advisor Meeting'}
                          </p>
                        </div>
                        {meeting.meetingLink && (
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={meeting.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Video className="mr-1 h-3 w-3" />
                              Join
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(meeting.startTime, "dd MMM yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(meeting.startTime, "HH:mm")}
                        </span>
                      </div>
                      {links.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {links.map((link, idx) => (
                            <a
                              key={idx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {link.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Past Meetings & Minutes</CardTitle>
            <CardDescription>
              Review past meetings and documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pastMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No past meetings recorded.
              </p>
            ) : (
              <ul className="space-y-3">
                {pastMeetings.slice(0, 10).map((meeting) => {
                  const documents = (meeting.documents as unknown as MeetingDocument[]) ?? [];
                  return (
                    <li
                      key={meeting.id}
                      className="rounded-md border p-4"
                    >
                      <div>
                        <p className="font-medium">{meeting.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {meeting.skill?.name ?? 'Skill Advisor Meeting'}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(meeting.startTime, "dd MMM yyyy")}
                        </span>
                      </div>
                      {(meeting.minutes || documents.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {meeting.minutes && (
                            <Badge variant="outline" className="text-xs">
                              <FileText className="mr-1 h-3 w-3" />
                              Minutes available
                            </Badge>
                          )}
                          {documents.map((doc, idx) => (
                            <a
                              key={idx}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {doc.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
