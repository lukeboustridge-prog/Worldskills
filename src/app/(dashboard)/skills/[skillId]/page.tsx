import { DeliverableState, GateStatus, Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDeliverableState } from "@/lib/utils";
import { getUserDisplayName } from "@/lib/users";
import {
  createGateAction,
  createMessageAction,
  deleteGateAction,
  updateGateStatusAction
} from "./actions";
import { DeliverablesTable, type DeliverableRow } from "./deliverables-table";
import {
  DUE_SOON_THRESHOLD_DAYS,
  classifyDeliverables,
  decorateDeliverable,
  ensureOverdueNotifications
} from "@/lib/deliverables";

const gateStatuses = Object.values(GateStatus);

export default async function SkillDetailPage({ params }: { params: { skillId: string } }) {
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
      deliverables: { orderBy: { dueDate: "asc" } },
      gates: { orderBy: { dueDate: "asc" } },
      messages: {
        include: { author: true },
        orderBy: { createdAt: "desc" }
      },
      activity: {
        include: { user: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!skill) {
    notFound();
  }

  const permittedUserIds = new Set([skill.saId, skill.scmId].filter(Boolean) as string[]);
  const isAdmin = user.isAdmin;
  const isSecretariat = user.role === Role.Secretariat;

  if (!isAdmin && !isSecretariat && !permittedUserIds.has(user.id)) {
    redirect("/dashboard");
  }

  const isAdvisor = user.isAdmin || (user.role === Role.SA && skill.saId === user.id);
  const canPostMessage = isAdmin || user.id === skill.saId || user.id === skill.scmId;
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

  const summary = classifyDeliverables(decoratedDeliverables);
  const completedDeliverablesCount =
    (summary.stateCounts[DeliverableState.Finalised] ?? 0) +
    (summary.stateCounts[DeliverableState.Uploaded] ?? 0) +
    (summary.stateCounts[DeliverableState.Validated] ?? 0);

  const deliverablesForClient: DeliverableRow[] = decoratedDeliverables.map((deliverable) => ({
    id: deliverable.id,
    label: deliverable.label,
    cMonthLabel: deliverable.cMonthLabel,
    dueDateISO: deliverable.dueDate.toISOString(),
    state: deliverable.state,
    evidenceLinks: deliverable.evidenceLinks,
    isOverdue: deliverable.isOverdue,
    overdueByDays: deliverable.overdueByDays
  }));

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
              <CardTitle>{decoratedDeliverables.length}</CardTitle>
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

      <Tabs defaultValue="deliverables" className="space-y-6">
        <TabsList>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="activity">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="deliverables" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deliverables</CardTitle>
              <CardDescription>
                Track the status of key competition artefacts and attach supporting evidence. Due dates are derived from the
                competition start date (C1) and cannot be edited manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {decoratedDeliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliverables recorded yet.</p>
              ) : (
                <DeliverablesTable
                  deliverables={deliverablesForClient}
                  skillId={skill.id}
                  isAdvisor={isAdvisor}
                  overdueCount={summary.overdue}
                  stateCounts={summary.stateCounts}
                  dueSoonThresholdDays={DUE_SOON_THRESHOLD_DAYS}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="gates" className="space-y-6">
          {isAdvisor ? (
            <Card>
              <CardHeader>
                <CardTitle>Add a gate</CardTitle>
                <CardDescription>Track key deadlines and gate approvals for this skill.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createGateAction} className="grid gap-4 md:grid-cols-2">
                  <input type="hidden" name="skillId" value={skill.id} />
                  <div className="space-y-2">
                    <Label htmlFor="gate-name">Gate name</Label>
                    <Input id="gate-name" name="name" placeholder="Validation workshop" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gate-date">Due date</Label>
                    <Input id="gate-date" name="dueDate" type="date" required />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">Create gate</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Gate tracking</CardTitle>
              <CardDescription>Monitor progress toward key milestones.</CardDescription>
            </CardHeader>
            <CardContent>
              {skill.gates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No gates scheduled yet.</p>
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
                        <TableCell>{format(gate.dueDate, "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={gate.status === GateStatus.Complete ? "default" : "outline"}>
                            {gate.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {isAdvisor ? (
                            <form action={updateGateStatusAction} className="inline-flex items-center gap-2">
                              <input type="hidden" name="skillId" value={skill.id} />
                              <input type="hidden" name="gateId" value={gate.id} />
                              <select
                                name="status"
                                defaultValue={gate.status}
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                              >
                                {gateStatuses.map((status) => (
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
                          {isAdvisor ? (
                            <form action={deleteGateAction} className="inline">
                              <input type="hidden" name="skillId" value={skill.id} />
                              <input type="hidden" name="gateId" value={gate.id} />
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
                <form action={createMessageAction} className="space-y-3">
                  <input type="hidden" name="skillId" value={skill.id} />
                  <Textarea
                    name="body"
                    placeholder="Share an update with your counterpart"
                    rows={4}
                    required
                  />
                  <Button type="submit">Send message</Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Secretariat viewers can read the latest messages for awareness.
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

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Automatic log of all changes and comments for this skill.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {skill.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                skill.activity.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {getUserDisplayName(entry.user)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {format(entry.createdAt, "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      {entry.action}
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
{JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
