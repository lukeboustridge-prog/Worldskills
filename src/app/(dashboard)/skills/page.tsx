import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { decorateDeliverable } from "@/lib/deliverables";
import { SKILL_CATALOG } from "@/lib/skill-catalog";
import { getUserDisplayName } from "@/lib/users";
import { deleteSkillAction } from "./actions";
import { CreateSkillDialog } from "./create-skill-dialog";
import { SkillAssignmentForm } from "./skill-assignment-form";
import { BroadcastMessageForm } from "./broadcast-message-form";
import { IndividualMessageForm } from "./individual-message-form";

export default async function SkillsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && user.role === Role.Pending) {
    redirect("/awaiting-access");
  }

  const isSecretariat = user.role === Role.Secretariat;
  const isSkillAdvisor = user.role === Role.SA;
  const isAdmin = user.isAdmin;
  const canViewSkills = isAdmin || isSkillAdvisor;

  if (!canViewSkills && !isSecretariat) {
    const skill = await prisma.skill.findFirst({ where: { scmId: user.id } });
    if (skill) {
      redirect(`/skills/${skill.id}`);
    }
    redirect("/dashboard");
  }

  const [settings, skillRecords, advisors, managers] = await Promise.all([
    getAppSettings(),
    prisma.skill.findMany({
      include: {
        sa: true,
        scm: true,
        deliverables: {
          select: {
            id: true,
            skillId: true,
            key: true,
            templateKey: true,
            label: true,
            cMonthOffset: true,
            dueDate: true,
            cMonthLabel: true,
            scheduleType: true,
            state: true,
            evidenceItems: true,
            updatedBy: true,
            updatedAt: true,
            createdAt: true,
            overdueNotifiedAt: true,
            isHidden: true
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: {
        OR: [{ role: Role.SA }, { isAdmin: true }]
      },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({ where: { role: Role.SCM }, orderBy: { name: "asc" } })
  ]);

  const skills = skillRecords.map((skill) => {
    const deliverables = skill.deliverables.map((deliverable) => decorateDeliverable(deliverable));
    const visibleDeliverables = deliverables.filter((deliverable) => !deliverable.isHidden);
    const overdueCount = visibleDeliverables.filter((deliverable) => deliverable.isOverdue).length;
    const hiddenCount = deliverables.length - visibleDeliverables.length;

    return {
      ...skill,
      deliverables,
      overdueCount,
      hiddenCount
    };
  });

  const canCreateSkill = Boolean(settings) && isAdmin;
  const disableReason = !settings
    ? "Competition settings must be configured before new skills can be created."
    : !isAdmin
      ? "You do not have permission to create new skills."
      : undefined;

  const catalogByName = new Map(SKILL_CATALOG.map((entry) => [entry.name, entry]));
  const usedSkillIds = Array.from(
    new Set(
      skills
        .map((skill) => catalogByName.get(skill.name)?.id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const advisorOptions = advisors.map((advisor) => ({
    id: advisor.id,
    label: getUserDisplayName(advisor)
  }));
  const managerOptions = managers.map((manager) => ({
    id: manager.id,
    label: getUserDisplayName(manager)
  }));

  const broadcastParam = searchParams?.broadcast;
  const broadcastStatus = Array.isArray(broadcastParam) ? broadcastParam[0] : broadcastParam;

  const advisorLookup = new Map(advisors.map((advisor) => [advisor.id, advisor]));

  const groupedByAdvisor = advisorOptions
    .map(({ id }) => ({
      advisor: advisorLookup.get(id),
      skills: skills.filter((skill) => skill.saId === id)
    }))
    .filter((group) => group.advisor && group.skills.length > 0)
    .sort((a, b) => {
      const nameA = getUserDisplayName(a.advisor!);
      const nameB = getUserDisplayName(b.advisor!);
      return nameA.localeCompare(nameB);
    });

  const unassignedSkills = skills.filter((skill) => !skill.saId || !skill.sa);

  const defaultAdvisorId = isAdmin ? "" : user.id;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Skills</h1>
          <p className="mt-1 text-muted-foreground">
            Manage WorldSkills assignments by advisor and keep roles aligned across the competition.
          </p>
        </div>
        {isAdmin ? (
          <CreateSkillDialog
            advisors={advisorOptions}
            managers={managerOptions}
            canCreate={canCreateSkill}
            disableReason={disableReason}
            defaultAdvisorId={defaultAdvisorId}
            isAdmin={isAdmin}
            usedSkillIds={usedSkillIds}
          />
        ) : null}
      </div>

      {broadcastStatus === "sent" ? (
        <div className="flex items-start justify-between gap-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-medium">Announcement sent to every skill conversation thread.</p>
          <Link
            href="/skills"
            className="text-xs font-semibold uppercase tracking-wide text-emerald-700 underline-offset-4 hover:underline"
          >
            Dismiss
          </Link>
        </div>
      ) : null}
      {broadcastStatus === "none" ? (
        <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium">No skills are available yet to receive a broadcast message.</p>
          <Link
            href="/skills"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground underline-offset-4 hover:underline"
          >
            Dismiss
          </Link>
        </div>
      ) : null}

      {(isAdmin || isSecretariat) && skills.length > 0 ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Message all skills</CardTitle>
            <CardDescription>
              Post an announcement to every skill conversation thread. The message will appear for each advisor and
              manager pair.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BroadcastMessageForm />
          </CardContent>
        </Card>
      ) : null}

      {skills.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No skills yet</CardTitle>
            <CardDescription>
              Create your first skill to automatically seed deliverables and start tracking competition readiness.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByAdvisor.map((group) => {
            const advisor = group.advisor!;
            const advisorName = getUserDisplayName(advisor);
            const plural = group.skills.length === 1 ? "skill" : "skills";

            return (
              <details key={advisor.id} className="group rounded-lg border bg-card">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-4 text-left font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">{advisorName}</p>
                    <p className="text-sm text-muted-foreground">{group.skills.length} {plural}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{group.skills.length} {plural}</Badge>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </div>
                </summary>
                <div className="border-t">
                  <div className="grid gap-4 p-6 lg:grid-cols-2">
                    {group.skills
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((skill) => {
                        const catalogEntry = catalogByName.get(skill.name);
                        const scmLabel = skill.scm ? getUserDisplayName(skill.scm) : "Unassigned";

                        const overdueCount = skill.overdueCount;

                        return (
                          <Card key={skill.id} className="h-full overflow-hidden">
                            <details className="group">
                            <summary className="grid gap-4 px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_auto]">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                                  {catalogEntry ? (
                                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                                      Skill {catalogEntry.code}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xl font-semibold text-foreground">{skill.name}</p>
                                  <p className="text-sm text-muted-foreground">SCM: {scmLabel}</p>
                                  {skill.scm?.email ? (
                                    <p className="text-xs text-muted-foreground">{skill.scm.email}</p>
                                  ) : null}
                                </div>
                              </div>
                            <div className="flex flex-col items-end gap-4 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {overdueCount > 0 ? (
                                  <Badge variant="destructive" className="whitespace-nowrap">
                                    {overdueCount} overdue
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10"
                                  >
                                    On track
                                  </Badge>
                                )}
                                {skill.hiddenCount > 0 ? (
                                  <Badge variant="outline" className="whitespace-nowrap border-dashed text-muted-foreground">
                                    {skill.hiddenCount} hidden
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="whitespace-nowrap text-xs text-muted-foreground">
                                  SA {getUserDisplayName(skill.sa)}
                                </Badge>
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-input bg-background">
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                                </div>
                              </div>
                            </div>
                            </summary>
                            <CardContent className="space-y-4 border-t bg-muted/10 px-6 py-6">
                              <div className="rounded-lg border bg-background p-4 shadow-sm">
                                {isAdmin || (isSkillAdvisor && skill.saId === user.id) ? (
                                  <SkillAssignmentForm
                                    skillId={skill.id}
                                    defaultSaId={skill.saId ?? null}
                                    defaultScmId={skill.scmId ?? null}
                                    advisorOptions={advisorOptions}
                                    managerOptions={managerOptions}
                                    workspaceHref={`/skills/${skill.id}`}
                                  />
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                      View the workspace to manage assignments.
                                    </p>
                                    <Button asChild size="sm" variant="outline">
                                      <Link href={`/skills/${skill.id}`}>Open workspace</Link>
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="rounded-lg border bg-background p-4 shadow-sm">
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-foreground">Send a message</p>
                                  {user.isAdmin || isSecretariat || user.id === skill.saId || user.id === skill.scmId ? (
                                    <IndividualMessageForm skillId={skill.id} />
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      Open the workspace to view the full conversation thread.
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isAdmin ? (
                                <form action={deleteSkillAction} className="flex justify-end">
                                  <input type="hidden" name="skillId" value={skill.id} />
                                  <Button type="submit" size="sm" variant="destructive">
                                    Delete skill
                                  </Button>
                                </form>
                              ) : null}
                            </CardContent>
                            </details>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              </details>
            );
          })}

          {unassignedSkills.length > 0 ? (
            <details className="group rounded-lg border bg-card">
              <summary className="grid gap-4 px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">Unassigned skills</p>
                  <p className="text-sm text-muted-foreground">
                    {unassignedSkills.length} {unassignedSkills.length === 1 ? "skill" : "skills"} awaiting assignment
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="destructive" className="whitespace-nowrap">Needs advisor</Badge>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-input bg-background">
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </div>
                </div>
              </summary>
              <div className="border-t">
                <div className="grid gap-4 p-6 lg:grid-cols-2">
                  {unassignedSkills
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((skill) => {
                      const catalogEntry = catalogByName.get(skill.name);
                      const overdueCount = skill.overdueCount;

                      return (
                        <Card key={skill.id} className="h-full overflow-hidden">
                          <details className="group">
                          <summary className="grid gap-4 px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                                {catalogEntry ? (
                                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                                    Skill {catalogEntry.code}
                                  </span>
                                ) : null}
                              </div>
                              <div className="space-y-1">
                                <p className="text-xl font-semibold text-foreground">{skill.name}</p>
                                <p className="text-sm text-muted-foreground">Assign a Skill Advisor to manage deliverables.</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-4 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {overdueCount > 0 ? (
                                  <Badge variant="destructive" className="whitespace-nowrap">
                                    {overdueCount} overdue
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="whitespace-nowrap text-muted-foreground">
                                    No overdue
                                  </Badge>
                                )}
                                {skill.hiddenCount > 0 ? (
                                  <Badge variant="outline" className="whitespace-nowrap border-dashed text-muted-foreground">
                                    {skill.hiddenCount} hidden
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="whitespace-nowrap text-xs text-muted-foreground">
                                  {skill.deliverables.length - skill.hiddenCount} active deliverables
                                </Badge>
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-input bg-background">
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                                </div>
                              </div>
                            </div>
                          </summary>
                          <CardContent className="space-y-4 border-t bg-muted/10 px-6 py-6">
                            <div className="rounded-lg border bg-background p-4 shadow-sm">
                              {isAdmin ? (
                                <SkillAssignmentForm
                                  skillId={skill.id}
                                  defaultSaId={skill.saId ?? null}
                                  defaultScmId={skill.scmId ?? null}
                                  advisorOptions={advisorOptions}
                                  managerOptions={managerOptions}
                                  workspaceHref={`/skills/${skill.id}`}
                                  isUnassigned
                                />
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-sm text-muted-foreground">
                                    View the workspace to manage assignments.
                                  </p>
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/skills/${skill.id}`}>Open workspace</Link>
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="rounded-lg border bg-background p-4 shadow-sm">
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-foreground">Send a message</p>
                                {user.isAdmin || isSecretariat || user.id === skill.saId || user.id === skill.scmId ? (
                                  <IndividualMessageForm skillId={skill.id} />
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    Open the workspace to view the full conversation thread.
                                  </p>
                                )}
                              </div>
                            </div>

                            {isAdmin ? (
                              <form action={deleteSkillAction} className="flex justify-end">
                                <input type="hidden" name="skillId" value={skill.id} />
                                <Button type="submit" size="sm" variant="destructive">
                                  Delete skill
                                </Button>
                              </form>
                            ) : null}
                          </CardContent>
                          </details>
                        </Card>
                      );
                    })}
                </div>
              </div>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
