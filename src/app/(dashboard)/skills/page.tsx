import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { getUserDisplayName } from "@/lib/users";
import { createSkillAction, deleteSkillAction, updateSkillAction } from "./actions";
import { SkillCatalogField } from "./skill-catalog-field";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SA && user.role !== Role.Admin) {
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
      orderBy: { createdAt: "desc" }
    }),
    prisma.user.findMany({ where: { role: Role.SA }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: Role.SCM }, orderBy: { name: "asc" } })
  ]);

  const canCreateSkill = Boolean(settings);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a new skill</CardTitle>
          <CardDescription>Assign the SA and SCM responsible for the skill.</CardDescription>
        </CardHeader>
        <CardContent>
          {canCreateSkill ? (
            <form action={createSkillAction} className="grid gap-4 md:grid-cols-2">
              <SkillCatalogField />
              <div className="space-y-2">
                <Label htmlFor="saId">Skill Advisor</Label>
                <select
                  id="saId"
                  name="saId"
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="" disabled>
                    Select Skill Advisor
                  </option>
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {getUserDisplayName(advisor)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scmId">Skill Competition Manager</Label>
                <select
                  id="scmId"
                  name="scmId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">Unassigned</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {getUserDisplayName(manager)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" placeholder="Key competition preparation notes" rows={4} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Create skill</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                Competition settings are not configured yet. An admin must set the competition start date before new skills can
                be created and scheduled.
              </p>
              {user.role === Role.Admin ? (
                <Button asChild variant="outline">
                  <Link href="/settings">Open competition settings</Link>
                </Button>
              ) : (
                <p className="text-muted-foreground">
                  Please contact an administrator to configure the competition start date.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Existing skills</h2>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills have been created yet.</p>
        ) : (
          <div className="grid gap-6">
            {skills.map((skill) => (
              <Card key={skill.id}>
                <CardHeader>
                  <CardTitle>{skill.name}</CardTitle>
                  <CardDescription className="space-y-1">
                    <div>Sector: {skill.sector ?? "Not recorded"}</div>
                    <div>
                      SA: {getUserDisplayName(skill.sa)} · SCM: {skill.scm
                        ? getUserDisplayName(skill.scm)
                        : "Unassigned"}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={updateSkillAction} className="grid gap-4 md:grid-cols-2">
                    <input type="hidden" name="skillId" value={skill.id} />
                    <div className="space-y-2">
                      <Label htmlFor={`name-${skill.id}`}>Name</Label>
                      <Input id={`name-${skill.id}`} name="name" defaultValue={skill.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`sector-${skill.id}`}>Sector</Label>
                      <Input
                        id={`sector-${skill.id}`}
                        name="sector"
                        defaultValue={skill.sector ?? ""}
                        placeholder="Select a skill to populate the sector"
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`sa-${skill.id}`}>Skill Advisor</Label>
                      <select
                        id={`sa-${skill.id}`}
                        name="saId"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={skill.saId}
                      >
                        {advisors.map((advisor) => (
                          <option key={advisor.id} value={advisor.id}>
                            {getUserDisplayName(advisor)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`scm-${skill.id}`}>Skill Competition Manager</Label>
                      <select
                        id={`scm-${skill.id}`}
                        name="scmId"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={skill.scmId ?? ""}
                      >
                        <option value="">Unassigned</option>
                        {managers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {getUserDisplayName(manager)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`notes-${skill.id}`}>Notes</Label>
                      <Textarea id={`notes-${skill.id}`} name="notes" defaultValue={skill.notes ?? ""} rows={4} />
                    </div>
                    <div className="flex items-center gap-4 md:col-span-2">
                      <Button type="submit">Save changes</Button>
                      <Button asChild variant="outline">
                        <Link href={`/skills/${skill.id}`}>Open workspace</Link>
                      </Button>
                    </div>
                  </form>
                  <form action={deleteSkillAction} className="flex justify-end">
                    <input type="hidden" name="skillId" value={skill.id} />
                    <Button type="submit" variant="destructive">
                      Delete skill
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
