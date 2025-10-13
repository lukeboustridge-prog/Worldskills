import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { decorateDeliverable } from "@/lib/deliverables";
import { SKILL_CATALOG } from "@/lib/skill-catalog";
import { getUserDisplayName } from "@/lib/users";
import { deleteSkillAction, updateSkillAction } from "./actions";
import { CreateSkillDialog } from "./create-skill-dialog";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const isSecretariat = user.role === Role.Secretariat;
  const canManageSkills = user.isAdmin || user.role === Role.SA;

  if (!canManageSkills && !isSecretariat) {
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
            dueDate: true,
            state: true
          }
        },
        messages: {
          include: { author: true },
          orderBy: { createdAt: "desc" },
          take: 3
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
    const overdueCount = deliverables.filter((deliverable) => deliverable.isOverdue).length;

    return {
      ...skill,
      deliverables,
      overdueCount
    };
  });

  const canCreateSkill = Boolean(settings) && canManageSkills;
  const disableReason = !settings
    ? "Competition settings must be configured before new skills can be created."
    : !canManageSkills
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

  const defaultAdvisorId = user.isAdmin ? "" : user.id;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Skills</h1>
          <p className="mt-1 text-muted-foreground">
            Manage WorldSkills assignments by advisor and keep roles aligned across the competition.
          </p>
        </div>
        {canManageSkills ? (
          <CreateSkillDialog
            advisors={advisorOptions}
            managers={managerOptions}
            canCreate={canCreateSkill}
            disableReason={disableReason}
            defaultAdvisorId={defaultAdvisorId}
            isAdmin={user.isAdmin}
            usedSkillIds={usedSkillIds}
          />
        ) : null}
      </div>

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
                              <summary className="flex cursor-pointer items-start justify-between gap-3 px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    {catalogEntry ? (
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        Skill {catalogEntry.code}
                                      </span>
                                    ) : null}
                                    <span className="font-medium text-foreground">Sector: {skill.sector ?? "Not recorded"}</span>
                                  </div>
                                  <p className="text-lg font-semibold text-foreground">{skill.name}</p>
                                  <p className="text-xs text-muted-foreground">SCM: {scmLabel}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  {overdueCount > 0 ? (
                                    <Badge variant="destructive" className="whitespace-nowrap">
                                      {overdueCount} overdue
                                    </Badge>
                                  ) : null}
                                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
                                </div>
                              </summary>
                              <CardContent className="space-y-4 border-t p-6 pt-6">
                                {canManageSkills ? (
                                  <form action={updateSkillAction} className="space-y-4">
                                    <input type="hidden" name="skillId" value={skill.id} />
                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <div className="space-y-1">
                                        <Label htmlFor={`sa-${skill.id}`}>Skill Advisor</Label>
                                        <select
                                          id={`sa-${skill.id}`}
                                          name="saId"
                                          defaultValue={skill.saId}
                                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                          required
                                        >
                                          {advisorOptions.map((advisorOption) => (
                                            <option key={advisorOption.id} value={advisorOption.id}>
                                              {advisorOption.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label htmlFor={`scm-${skill.id}`}>Skill Competition Manager</Label>
                                        <select
                                          id={`scm-${skill.id}`}
                                          name="scmId"
                                          defaultValue={skill.scmId ?? ""}
                                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        >
                                          <option value="">Unassigned</option>
                                          {managerOptions.map((manager) => (
                                            <option key={manager.id} value={manager.id}>
                                              {manager.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button type="submit" size="sm">
                                        Save changes
                                      </Button>
                                      <Button asChild size="sm" variant="outline">
                                        <Link href={`/skills/${skill.id}`}>Open workspace</Link>
                                      </Button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="flex justify-end">
                                    <Button asChild size="sm" variant="outline">
                                      <Link href={`/skills/${skill.id}`}>Open workspace</Link>
                                    </Button>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-foreground">Latest messages</p>
                                  {skill.messages.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {skill.messages.map((message) => (
                                        <li key={message.id} className="rounded-md border px-3 py-2">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-foreground">
                                              {getUserDisplayName(message.author)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {format(message.createdAt, "dd MMM yyyy")}
                                            </span>
                                          </div>
                                          <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                                            {message.body}
                                          </p>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                {canManageSkills ? (
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
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-4 text-left font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">Unassigned</p>
                  <p className="text-sm text-muted-foreground">
                    {unassignedSkills.length} {unassignedSkills.length === 1 ? "skill" : "skills"}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
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
                            <summary className="flex cursor-pointer items-start justify-between gap-3 px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  {catalogEntry ? (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                      Skill {catalogEntry.code}
                                    </span>
                                  ) : null}
                                  <span className="font-medium text-foreground">Sector: {skill.sector ?? "Not recorded"}</span>
                                </div>
                                <p className="text-lg font-semibold text-foreground">{skill.name}</p>
                                <p className="text-xs text-muted-foreground">Assign a Skill Advisor to manage deliverables.</p>
                              </div>
                              <div className="flex items-start gap-2">
                                {overdueCount > 0 ? (
                                  <Badge variant="destructive" className="whitespace-nowrap">
                                    {overdueCount} overdue
                                  </Badge>
                                ) : null}
                                <ChevronRight className="mt-1 h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
                              </div>
                            </summary>
                            <CardContent className="space-y-4 border-t p-6 pt-6">
                              {canManageSkills ? (
                                <form action={updateSkillAction} className="space-y-4">
                                  <input type="hidden" name="skillId" value={skill.id} />
                                  <div className="space-y-1">
                                    <Label htmlFor={`unassigned-sa-${skill.id}`}>Skill Advisor</Label>
                                    <select
                                      id={`unassigned-sa-${skill.id}`}
                                      name="saId"
                                      defaultValue=""
                                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                      required
                                    >
                                      <option value="" disabled>
                                        Select Skill Advisor
                                      </option>
                                      {advisorOptions.map((advisor) => (
                                        <option key={advisor.id} value={advisor.id}>
                                          {advisor.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`unassigned-scm-${skill.id}`}>Skill Competition Manager</Label>
                                    <select
                                      id={`unassigned-scm-${skill.id}`}
                                      name="scmId"
                                      defaultValue={skill.scmId ?? ""}
                                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                      <option value="">Unassigned</option>
                                      {managerOptions.map((manager) => (
                                        <option key={manager.id} value={manager.id}>
                                          {manager.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button type="submit" size="sm">
                                      Save changes
                                    </Button>
                                    <Button asChild size="sm" variant="outline">
                                      <Link href={`/skills/${skill.id}`}>Open workspace</Link>
                                    </Button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex justify-end">
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/skills/${skill.id}`}>Open workspace</Link>
                                  </Button>
                                </div>
                              )}

                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-foreground">Latest messages</p>
                                {skill.messages.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {skill.messages.map((message) => (
                                      <li key={message.id} className="rounded-md border px-3 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-medium text-foreground">
                                            {getUserDisplayName(message.author)}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {format(message.createdAt, "dd MMM yyyy")}
                                          </span>
                                        </div>
                                        <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                                          {message.body}
                                        </p>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              {canManageSkills ? (
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
