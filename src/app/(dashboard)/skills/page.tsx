import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { SKILL_CATALOG } from "@/lib/skill-catalog";
import { getUserDisplayName } from "@/lib/users";
import { deleteSkillAction, updateSkillAction } from "./actions";
import { CreateSkillDialog } from "./create-skill-dialog";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SA && !user.isAdmin) {
    const skill = await prisma.skill.findFirst({ where: { scmId: user.id } });
    if (skill) {
      redirect(`/skills/${skill.id}`);
    }
    redirect("/dashboard");
  }

  const [settings, skills, advisors, managers] = await Promise.all([
    getAppSettings(),
    prisma.skill.findMany({
      include: {
        sa: true,
        scm: true
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

  const canCreateSkill = Boolean(settings);
  const disableReason = canCreateSkill
    ? undefined
    : "Competition settings must be configured before new skills can be created.";

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
        <CreateSkillDialog
          advisors={advisorOptions}
          managers={managerOptions}
          canCreate={canCreateSkill}
          disableReason={disableReason}
          defaultAdvisorId={defaultAdvisorId}
          isAdmin={user.isAdmin}
          usedSkillIds={usedSkillIds}
        />
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
        <div className="space-y-10">
          {groupedByAdvisor.map((group) => {
            const advisorName = getUserDisplayName(group.advisor!);
            const plural = group.skills.length === 1 ? "skill" : "skills";

            return (
              <section key={group.advisor!.id} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">{advisorName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {group.skills.length} {plural}
                    </p>
                  </div>
                  <Badge variant="outline">{group.skills.length} {plural}</Badge>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {group.skills
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((skill) => {
                      const catalogEntry = catalogByName.get(skill.name);
                      const scmLabel = skill.scm ? getUserDisplayName(skill.scm) : "Unassigned";

                      return (
                        <Card key={skill.id} className="h-full">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                                  {catalogEntry ? (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                      Skill {catalogEntry.code}
                                    </span>
                                  ) : null}
                                  <span>{skill.name}</span>
                                </CardTitle>
                                <CardDescription>
                                  Sector: {skill.sector ?? "Not recorded"}
                                </CardDescription>
                              </div>
                              <Badge variant="outline">SCM: {scmLabel}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
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
                                    {advisorOptions.map((advisor) => (
                                      <option key={advisor.id} value={advisor.id}>
                                        {advisor.label}
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
                              <div className="space-y-1">
                                <Label htmlFor={`notes-${skill.id}`}>Notes</Label>
                                <Textarea
                                  id={`notes-${skill.id}`}
                                  name="notes"
                                  defaultValue={skill.notes ?? ""}
                                  rows={3}
                                  placeholder="Key competition preparation notes"
                                />
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
                            <form action={deleteSkillAction} className="flex justify-end">
                              <input type="hidden" name="skillId" value={skill.id} />
                              <Button type="submit" size="sm" variant="destructive">
                                Delete skill
                              </Button>
                            </form>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </section>
            );
          })}

          {unassignedSkills.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Unassigned</h2>
                  <p className="text-sm text-muted-foreground">
                    {unassignedSkills.length} {unassignedSkills.length === 1 ? "skill" : "skills"}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {unassignedSkills
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((skill) => {
                    const catalogEntry = catalogByName.get(skill.name);

                    return (
                      <Card key={skill.id} className="h-full">
                        <CardHeader>
                          <div className="space-y-1">
                            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                              {catalogEntry ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  Skill {catalogEntry.code}
                                </span>
                              ) : null}
                              <span>{skill.name}</span>
                            </CardTitle>
                            <CardDescription>Sector: {skill.sector ?? "Not recorded"}</CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground">Assign a Skill Advisor to manage deliverables.</p>
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
                            <div className="space-y-1">
                              <Label htmlFor={`unassigned-notes-${skill.id}`}>Notes</Label>
                              <Textarea
                                id={`unassigned-notes-${skill.id}`}
                                name="notes"
                                defaultValue={skill.notes ?? ""}
                                rows={3}
                                placeholder="Key competition preparation notes"
                              />
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
                          <form action={deleteSkillAction} className="flex justify-end">
                            <input type="hidden" name="skillId" value={skill.id} />
                            <Button type="submit" size="sm" variant="destructive">
                              Delete skill
                            </Button>
                          </form>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
