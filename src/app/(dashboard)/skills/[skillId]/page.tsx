import {
  DeliverableState,
  GateScheduleType as MilestoneScheduleType,
  GateStatus as MilestoneStatus,
  Role
} from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDeliverableState } from "@/lib/utils";
import { getUserDisplayName } from "@/lib/users";
import { deleteMilestoneAction, updateMilestoneStatusAction, inviteSkillTeamMemberAction } from "./actions";
import { DeliverablesTable, type DeliverableRow } from "./deliverables-table";
import { CreateMilestoneForm } from "./create-milestone-form";
import { MessageForm } from "./message-form";
import { MeetingList, type MeetingData } from "./meeting-list";
import {
  DUE_SOON_THRESHOLD_DAYS,
  classifyDeliverables,
  decorateDeliverable,
  ensureOverdueNotifications
} from "@/lib/deliverables";
import type { MeetingDocument, MeetingLink } from "./meeting-actions";
import type { Prisma } from "@prisma/client";

function normaliseMeetingDocuments(value: Prisma.JsonValue | null | undefined): MeetingDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      const fileName = typeof record.fileName === "string" ? record.fileName : null;
      const storageKey = typeof record.storageKey === "string" ? record.storageKey : null;
      const fileSize = typeof record.fileSize === "number" ? record.fileSize : 0;
      const mimeType = typeof record.mimeType === "string" ? record.mimeType : "application/octet-stream";
      const uploadedAt = typeof record.uploadedAt === "string" ? record.uploadedAt : new Date().toISOString();

      if (!id || !fileName || !storageKey) {
        return null;
      }

      return { id, fileName, storageKey, fileSize, mimeType, uploadedAt };
    })
    .filter((item): item is MeetingDocument => item !== null);
}

function normaliseMeetingLinks(value: Prisma.JsonValue | null | undefined): MeetingLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      const label = typeof record.label === "string" ? record.label : null;
      const url = typeof record.url === "string" ? record.url : null;
      const addedAt = typeof record.addedAt === "string" ? record.addedAt : new Date().toISOString();

      if (!id || !label || !url) {
        return null;
      }

      return { id, label, url, addedAt };
    })
    .filter((item): item is MeetingLink => item !== null);
}

const milestoneStatuses = Object.values(MilestoneStatus);

export default async function SkillDetailPage({
  params,
  searchParams
}: {
  params: { skillId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && user.role === Role.Pending) {
    redirect("/awaiting-access");
  }

  const skill = await prisma.skill.findUnique({
    where: { id: params.skillId },
    include: {
      sa: true,
      scm: true,
      teamMembers: { include: { user: true } },
      deliverables: { orderBy: { dueDate: "asc" } },
      gates: { orderBy: { dueDate: "asc" } },
      messages: {
        where: {
          NOT: {
            body: {
              startsWith: "System:"
            }
          }
        },
        include: { author: true },
        orderBy: { createdAt: "desc" }
      },
      meetings: { orderBy: { startTime: "asc" } }
    }
  });

  if (!skill) {
    notFound();
  }

  const teamMemberIds = skill.teamMembers.map((member) => member.userId);
  const permittedUserIds = new Set([skill.saId, skill.scmId, ...teamMemberIds].filter(Boolean) as string[]);
  const isAdmin = user.isAdmin;
  const isSecretariat = user.role === Role.Secretariat;
  const isSkillTeamMember = teamMemberIds.includes(user.id);

  if (!isAdmin && !isSecretariat && !permittedUserIds.has(user.id)) {
    redirect("/dashboard");
  }

  const canEditSkill = user.isAdmin || user.id === skill.saId || user.id === skill.scmId || isSkillTeamMember;
  const canValidateDeliverables = user.isAdmin || user.id === skill.saId;
  const canPostMessage =
    isAdmin || isSecretariat || user.id === skill.saId || user.id === skill.scmId || isSkillTeamMember;
  const canInviteSkillTeam = user.isAdmin || user.id === skill.saId;
  const advisorLabel = getUserDisplayName(skill.sa);
  const managerLabel = skill.scm ? getUserDisplayName(skill.scm) : "Unassigned";

  const decoratedDeliverables = skill.deliverables.map((deliverable) => decorateDeliverable(deliverable));
  if (user.role === Role.SA || user.isAdmin) {
    await ensureOverdueNotifications({
      skillId: skill.id,
      deliverables: decoratedDeliverables,
      saId: skill.saId
    });
  }

  const visibleDeliverables = decoratedDeliverables.filter((deliverable) => !deliverable.isHidden);
  const hiddenDeliverablesCount = decoratedDeliverables.length - visibleDeliverables.length;

  const summary = classifyDeliverables(decoratedDeliverables);
  const completedDeliverablesCount =
    (summary.stateCounts[DeliverableState.Finalised] ?? 0) +
    (summary.stateCounts[DeliverableState.Uploaded] ?? 0) +
    (summary.stateCounts[DeliverableState.Validated] ?? 0);

  const deliverablesForClient: DeliverableRow[] = decoratedDeliverables.map((deliverable) => ({
    id: deliverable.id,
    key: deliverable.key,
    templateKey: deliverable.templateKey ?? null,
    label: deliverable.label,
    cMonthLabel: deliverable.cMonthLabel,
    cMonthOffset: deliverable.cMonthOffset,
    dueDateISO: deliverable.dueDate.toISOString(),
    scheduleType: deliverable.scheduleType,
    state: deliverable.state,
    evidence: deliverable.evidenceItems,
    isOverdue: deliverable.isOverdue,
    overdueByDays: deliverable.overdueByDays,
    isHidden: deliverable.isHidden
  }));

  const meetingsForClient: MeetingData[] = skill.meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    startTimeISO: meeting.startTime.toISOString(),
    endTimeISO: meeting.endTime.toISOString(),
    meetingLink: meeting.meetingLink,
    minutes: meeting.minutes,
    actionPoints: meeting.actionPoints,
    documents: normaliseMeetingDocuments(meeting.documents),
    links: normaliseMeetingLinks(meeting.links)
  }));

  const canManageMeetings = isAdmin || user.id === skill.saId || user.id === skill.scmId || isSkillTeamMember;

  const inviteParam = searchParams?.invite;
  const inviteErrorParam = searchParams?.inviteError;
  const inviteSuccess = (Array.isArray(inviteParam) ? inviteParam[0] : inviteParam) === "sent";
  const inviteError = Array.isArray(inviteErrorParam) ? inviteErrorParam[0] : inviteErrorParam ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{skill.name}</h1>
          <p className="text-muted-foreground">SA: {advisorLabel} · SCM: {managerLabel}</p>
          <p className="text-sm text-muted-foreground">Sector: {skill.sector ?? "Not recorded"}</p>
          <p className="text-sm text-muted-foreground">{skill.notes ?? "No notes added yet."}</p>
        </div>
        <div className="flex gap-3">
          <Card className="min-w-[160px]">
            <CardHeader className="p-4 pb-0">
              <CardDescription>Deliverables complete</CardDescription>
              <CardTitle>{completedDeliverablesCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="min-w-[160px]">
            <CardHeader className="p-4 pb-0">
              <CardDescription>Total deliverables</CardDescription>
              <CardTitle>{summary.total}</CardTitle>
              {hiddenDeliverablesCount > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {hiddenDeliverablesCount} hidden
                </p>
              ) : null}
            </CardHeader>
          </Card>
          <Card className="min-w-[160px]">
            <CardHeader className="p-4 pb-0">
              <CardDescription>Overdue deliverables</CardDescription>
              <CardTitle className={summary.overdue > 0 ? "text-red-600" : ""}>{summary.overdue}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {inviteSuccess ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Invitation sent. Ask the new team member to check their email for the setup link.
        </div>
      ) : null}
      {inviteError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {inviteError}
        </div>
      ) : null}

      <Tabs defaultValue="deliverables" className="space-y-6">
        <TabsList>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="deliverables" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deliverables</CardTitle>
              <CardDescription>
                Track the status of key competition artefacts and attach supporting evidence. Schedule each deliverable by
                choosing a calendar deadline or an offset from the competition start date (C1).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visibleDeliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {decoratedDeliverables.length === 0
                    ? "No deliverables recorded yet."
                    : "All deliverables for this skill are currently hidden. Unhide deliverables to track progress."}
                </p>
              ) : (
                <DeliverablesTable
                  deliverables={deliverablesForClient}
                  skillId={skill.id}
                  canEdit={canEditSkill}
                  canValidate={canValidateDeliverables}
                  overdueCount={summary.overdue}
                  stateCounts={summary.stateCounts}
                  dueSoonThresholdDays={DUE_SOON_THRESHOLD_DAYS}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6">
          <MeetingList
            meetings={meetingsForClient}
            skillId={skill.id}
            canManage={canManageMeetings}
          />
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          {canEditSkill ? (
            <Card>
              <CardHeader>
                <CardTitle>Add a milestone</CardTitle>
                <CardDescription>Track key deadlines and approvals for this skill.</CardDescription>
              </CardHeader>
              <CardContent>
                <CreateMilestoneForm skillId={skill.id} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Milestone tracking</CardTitle>
              <CardDescription>Monitor progress toward key milestones.</CardDescription>
            </CardHeader>
            <CardContent>
              {skill.gates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones scheduled yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skill.gates.map((gate) => (
                      <TableRow key={gate.id}>
                        <TableCell>{gate.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{format(gate.dueDate, "dd MMM yyyy")}</span>
                            {gate.scheduleType === MilestoneScheduleType.CMonth && gate.cMonthLabel ? (
                              <span className="text-xs text-muted-foreground">{gate.cMonthLabel}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Calendar date</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={gate.status === MilestoneStatus.Complete ? "default" : "outline"}>
                            {gate.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {canEditSkill ? (
                            <form action={updateMilestoneStatusAction} className="inline-flex items-center gap-2">
                              <input type="hidden" name="skillId" value={skill.id} />
                              <input type="hidden" name="milestoneId" value={gate.id} />
                              <select
                                name="status"
                                defaultValue={gate.status}
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                              >
                                {milestoneStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                              <Button type="submit" size="sm">
                                Update
                              </Button>
                            </form>
                          ) : null}
                          {canEditSkill ? (
                            <form action={deleteMilestoneAction} className="inline">
                              <input type="hidden" name="skillId" value={skill.id} />
                              <input type="hidden" name="milestoneId" value={gate.id} />
                              <Button type="submit" variant="destructive" size="sm">
                                Delete
                              </Button>
                            </form>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>Use this thread to keep each other informed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canPostMessage ? (
                <MessageForm skillId={skill.id} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  You can read previous messages but do not have permission to post in this conversation.
                </p>
              )}
              <div className="space-y-4">
                {skill.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  skill.messages.map((message) => (
                    <div key={message.id} className="rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {getUserDisplayName(message.author)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {format(message.createdAt, "dd MMM yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-line">{message.body}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invite a Skill Team member</CardTitle>
              <CardDescription>
                Add a teammate to this skill with Skill Team access (same permissions as the SCM).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canInviteSkillTeam ? (
                <form action={inviteSkillTeamMemberAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="skillId" value={skill.id} />
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Full name</Label>
                    <Input id="invite-name" name="name" required placeholder="Alex Team Member" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input id="invite-email" name="email" type="email" required placeholder="alex@example.com" />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit">Send invite</Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only the assigned Skill Advisor can invite Skill Team members.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skill Team</CardTitle>
              <CardDescription>People who can help manage this skill.</CardDescription>
            </CardHeader>
            <CardContent>
              {skill.teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Skill Team members added yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {skill.teamMembers.map((member) => (
                    <li key={member.id} className="rounded-md border px-3 py-2">
                      <p className="font-medium">{getUserDisplayName(member.user)}</p>
                      <p className="text-xs text-muted-foreground">{member.user.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
