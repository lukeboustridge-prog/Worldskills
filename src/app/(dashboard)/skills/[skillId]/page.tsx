import { DeliverableState, DeliverableType, GateStatus, Role } from "@prisma/client";
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
import { formatDeliverableState, formatDeliverableType } from "@/lib/utils";
import {
  appendEvidenceAction,
  createDeliverableAction,
  createGateAction,
  createMessageAction,
  deleteDeliverableAction,
  deleteGateAction,
  updateDeliverableStateAction,
  updateGateStatusAction
} from "./actions";

const deliverableTypes = Object.values(DeliverableType);
const deliverableStates = Object.values(DeliverableState);
const gateStatuses = Object.values(GateStatus);

export default async function SkillDetailPage({ params }: { params: { skillId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const skill = await prisma.skill.findUnique({
    where: { id: params.skillId },
    include: {
      sa: true,
      scm: true,
      deliverables: { orderBy: { updatedAt: "desc" } },
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

  if (![skill.saId, skill.scmId].includes(user.id)) {
    redirect("/dashboard");
  }

  const isAdvisor = user.role === Role.SA && skill.saId === user.id;

  const completedDeliverables = skill.deliverables.filter((deliverable) =>
    [DeliverableState.Finalised, DeliverableState.Uploaded, DeliverableState.Validated].includes(
      deliverable.state
    )
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{skill.name}</h1>
          <p className="text-muted-foreground">
            SA: {skill.sa.name ?? skill.sa.email} · SCM: {skill.scm.name ?? skill.scm.email}
          </p>
          <p className="text-sm text-muted-foreground">{skill.notes ?? "No notes added yet."}</p>
        </div>
        <div className="flex gap-3">
          <Card className="min-w-[160px]">
            <CardHeader className="p-4 pb-0">
              <CardDescription>Deliverables complete</CardDescription>
              <CardTitle>{completedDeliverables}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="min-w-[160px]">
            <CardHeader className="p-4 pb-0">
              <CardDescription>Total deliverables</CardDescription>
              <CardTitle>{skill.deliverables.length}</CardTitle>
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
          {isAdvisor ? (
            <Card>
              <CardHeader>
                <CardTitle>Add a deliverable</CardTitle>
                <CardDescription>
                  Select the deliverable type and optionally provide initial evidence for context.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createDeliverableAction} className="grid gap-4 md:grid-cols-2">
                  <input type="hidden" name="skillId" value={skill.id} />
                  <div className="space-y-2">
                    <Label htmlFor="type">Deliverable type</Label>
                    <select
                      id="type"
                      name="type"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {deliverableTypes.map((type) => (
                        <option key={type} value={type}>
                          {formatDeliverableType(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="evidence">Initial evidence link (optional)</Label>
                    <Input
                      id="evidence"
                      name="evidence"
                      placeholder="https://..."
                      type="url"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">Create deliverable</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Deliverables</CardTitle>
              <CardDescription>
                Track the status of key competition artefacts and attach supporting evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {skill.deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deliverables recorded yet.</p>
              ) : (
                skill.deliverables.map((deliverable) => {
                  const updatedByLabel =
                    deliverable.updatedBy === skill.saId
                      ? skill.sa.name ?? skill.sa.email
                      : deliverable.updatedBy === skill.scmId
                      ? skill.scm.name ?? skill.scm.email
                      : deliverable.updatedBy ?? "N/A";
                  return (
                  <div key={deliverable.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-medium">{formatDeliverableType(deliverable.type)}</h3>
                        <p className="text-xs text-muted-foreground">
                          Last updated {format(deliverable.updatedAt, "dd MMM yyyy HH:mm")} by {updatedByLabel}
                        </p>
                      </div>
                      <Badge variant="outline">{formatDeliverableState(deliverable.state)}</Badge>
                    </div>

                    {deliverable.evidenceLinks.length ? (
                      <ul className="mt-3 space-y-1 text-sm">
                        {deliverable.evidenceLinks.map((link, index) => (
                          <li key={index}>
                            <a className="underline" href={link} target="_blank" rel="noreferrer">
                              Evidence #{index + 1}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">No evidence links added yet.</p>
                    )}

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                      {isAdvisor ? (
                        <form action={updateDeliverableStateAction} className="flex items-center gap-2">
                          <input type="hidden" name="skillId" value={skill.id} />
                          <input type="hidden" name="deliverableId" value={deliverable.id} />
                          <Label htmlFor={`state-${deliverable.id}`} className="text-xs uppercase text-muted-foreground">
                            State
                          </Label>
                          <select
                            id={`state-${deliverable.id}`}
                            name="state"
                            defaultValue={deliverable.state}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {deliverableStates.map((state) => (
                              <option key={state} value={state}>
                                {formatDeliverableState(state)}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="sm">
                            Update
                          </Button>
                        </form>
                      ) : null}

                      <form action={appendEvidenceAction} className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="skillId" value={skill.id} />
                        <input type="hidden" name="deliverableId" value={deliverable.id} />
                        <Input
                          type="url"
                          name="evidence"
                          placeholder="Add evidence URL"
                          className="flex-1"
                          required
                        />
                        <Button type="submit" variant="secondary">
                          Add evidence
                        </Button>
                      </form>

                      {isAdvisor ? (
                        <form action={deleteDeliverableAction}>
                          <input type="hidden" name="skillId" value={skill.id} />
                          <input type="hidden" name="deliverableId" value={deliverable.id} />
                          <Button type="submit" variant="destructive" size="sm">
                            Delete
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  );
                })
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
              <div className="space-y-4">
                {skill.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  skill.messages.map((message) => (
                    <div key={message.id} className="rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {message.author.name ?? message.author.email}
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
                        {entry.user.name ?? entry.user.email}
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
