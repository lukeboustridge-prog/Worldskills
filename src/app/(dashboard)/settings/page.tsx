import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth";
import { getDeliverableTemplates, buildCMonthLabel } from "@/lib/deliverables";
import { getAppSettings } from "@/lib/settings";
import {
  createDeliverableTemplateAction,
  createMissingDeliverablesAction,
  saveCompetitionSettingsAction,
  updateDeliverableTemplateAction,
  updateUserRoleAction
} from "./actions";
import { prisma } from "@/lib/prisma";
import { getUserDisplayName } from "@/lib/users";

function formatDateInput(value: Date | null | undefined) {
  if (!value) return "";
  return format(value, "yyyy-MM-dd");
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isAdmin) {
    redirect("/dashboard");
  }

  const settings = await getAppSettings();
  const keyDatesValue = settings?.keyDates ? JSON.stringify(settings.keyDates, null, 2) : "";
  const updated = typeof searchParams?.updated === "string";
  const recalculated = typeof searchParams?.recalculated === "string";
  const backfilled = typeof searchParams?.backfilled === "string";
  const createdCount = typeof searchParams?.created === "string" ? Number(searchParams.created) : 0;
  const templateCreatedKey = typeof searchParams?.templateCreated === "string" ? searchParams.templateCreated : null;
  const templateUpdatedKey = typeof searchParams?.templateUpdated === "string" ? searchParams.templateUpdated : null;
  const addedCount = typeof searchParams?.added === "string" ? Number(searchParams.added) : 0;
  const userUpdated = typeof searchParams?.userUpdated === "string";
  const userQuery = typeof searchParams?.userQuery === "string" ? searchParams.userQuery.trim() : "";

  const [templates, users] = await Promise.all([
    getDeliverableTemplates(),
    prisma.user.findMany({
      where: userQuery
        ? {
            OR: [
              { name: { contains: userQuery, mode: "insensitive" } },
              { email: { contains: userQuery.toLowerCase(), mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: [{ name: "asc" }, { email: "asc" }]
    })
  ]);

  const createdTemplate = templateCreatedKey
    ? templates.find((template) => template.key === templateCreatedKey)
    : null;
  const updatedTemplate = templateUpdatedKey
    ? templates.find((template) => template.key === templateUpdatedKey)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground">Manage competition dates and deliverable schedules.</p>
      </div>

      <div className="space-y-4">
        {updated ? (
          <div className="rounded-md border border-green-400 bg-green-50 p-4 text-sm text-green-900">
            Competition settings saved successfully.{" "}
            {recalculated ? "All deliverable due dates were recalculated." : null}
          </div>
        ) : null}
        {backfilled ? (
          <div className="rounded-md border border-blue-400 bg-blue-50 p-4 text-sm text-blue-900">
            Missing deliverables have been created for all skills. {createdCount} new deliverables were added.
          </div>
        ) : null}
        {templateCreatedKey ? (
          <div className="rounded-md border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
            {createdTemplate ? `Added ${createdTemplate.label}` : `Added ${templateCreatedKey}`} to the catalog.
            {addedCount > 0 ? ` Created ${addedCount} deliverables across existing skills.` : ""}
          </div>
        ) : null}
        {templateUpdatedKey ? (
          <div className="rounded-md border border-purple-400 bg-purple-50 p-4 text-sm text-purple-900">
            {updatedTemplate ? `${updatedTemplate.label}` : templateUpdatedKey} updated. Due dates and labels were refreshed for all skills.
          </div>
        ) : null}
        {userUpdated ? (
          <div className="rounded-md border border-slate-400 bg-slate-50 p-4 text-sm text-slate-900">
            User permissions updated successfully.
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competition timeline</CardTitle>
          <CardDescription>
            Update the competition name, key dates, and confirm recalculation when adjusting the C1 start date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveCompetitionSettingsAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="competitionName">Competition name</Label>
              <Input
                id="competitionName"
                name="competitionName"
                defaultValue={settings?.competitionName ?? "WorldSkills Competition"}
                placeholder="WorldSkills Competition 2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitionStart">Competition start (C1)</Label>
              <Input
                id="competitionStart"
                name="competitionStart"
                type="date"
                defaultValue={formatDateInput(settings?.competitionStart)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitionEnd">Competition end (C4)</Label>
              <Input
                id="competitionEnd"
                name="competitionEnd"
                type="date"
                defaultValue={formatDateInput(settings?.competitionEnd)}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="keyDates">Key dates (JSON)</Label>
              <Textarea
                id="keyDates"
                name="keyDates"
                placeholder='{"CPW": "2025-09-01"}'
                defaultValue={keyDatesValue}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Provide additional milestone dates in JSON format. These dates are informational and visible to Skill Advisors
                and Managers.
              </p>
            </div>
            <div className="md:col-span-2 space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <Label className="flex items-center gap-2" htmlFor="confirmRecalculate">
                <input type="checkbox" id="confirmRecalculate" name="confirmRecalculate" />
                I understand that changing C1 recalculates all deliverable due dates across every skill.
              </Label>
              <p className="text-xs text-muted-foreground">
                Deliverable due dates are derived from the competition start date. To adjust individual skills, update C1 here
                and confirm the recalculation.
              </p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Save settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standard deliverable catalog</CardTitle>
          <CardDescription>
            Every skill is seeded with these deliverables. Adjust labels, offsets, and ordering to match the latest guidance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            action={createDeliverableTemplateAction}
            className="grid gap-4 rounded-md border border-dashed p-4 md:grid-cols-[2fr_repeat(2,minmax(0,1fr))_auto]"
          >
            <div className="space-y-2">
              <Label htmlFor="new-label">New deliverable label</Label>
              <Input id="new-label" name="label" placeholder="WorldSkills Orientation" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-offset">Months before C1</Label>
              <Input id="new-offset" name="offsetMonths" type="number" min={0} max={48} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-position">Position</Label>
              <Input id="new-position" name="position" type="number" min={1} placeholder={`${templates.length + 1}`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-key">Key (optional)</Label>
              <Input id="new-key" name="key" placeholder="OrientationWorkshop" />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add deliverable</Button>
            </div>
          </form>

          <div className="space-y-4">
            {templates.map((template) => (
              <div key={template.key} className="rounded-md border p-4">
                <form
                  action={updateDeliverableTemplateAction}
                  className="grid gap-4 md:grid-cols-[2fr_repeat(2,minmax(0,1fr))_auto]"
                >
                  <input type="hidden" name="key" value={template.key} />
                  <div className="space-y-2">
                    <Label htmlFor={`label-${template.key}`}>Label</Label>
                    <Input id={`label-${template.key}`} name="label" defaultValue={template.label} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`offset-${template.key}`}>Months before C1</Label>
                    <Input
                      id={`offset-${template.key}`}
                      name="offsetMonths"
                      type="number"
                      min={0}
                      max={48}
                      defaultValue={template.offsetMonths}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`position-${template.key}`}>Position</Label>
                    <Input
                      id={`position-${template.key}`}
                      name="position"
                      type="number"
                      min={1}
                      defaultValue={template.position}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" variant="outline">
                      Save
                    </Button>
                  </div>
                </form>
                <p className="mt-2 text-xs text-muted-foreground">
                  Key: <span className="font-mono">{template.key}</span> · {buildCMonthLabel(template.offsetMonths)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User management</CardTitle>
          <CardDescription>Adjust base roles and admin access. Admins automatically appear in Skill Advisor lists.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <details className="rounded-md border p-4" open={userQuery.length > 0}>
            <summary className="cursor-pointer font-medium">Search &amp; filters</summary>
            <form method="get" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="userQuery">Search users</Label>
                <Input
                  id="userQuery"
                  name="userQuery"
                  defaultValue={userQuery}
                  placeholder="Search by name or email"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit">Search</Button>
                {userQuery ? (
                  <Button type="button" variant="outline" asChild>
                    <Link href="/settings">Clear</Link>
                  </Button>
                ) : null}
              </div>
            </form>
          </details>

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users match the current search.</p>
          ) : (
            <div className="space-y-4">
              {users.map((record) => (
                <div key={record.id} className="rounded-md border p-4">
                  <div className="mb-3">
                    <p className="font-medium">{getUserDisplayName(record)}</p>
                    <p className="text-xs text-muted-foreground">{record.email}</p>
                  </div>
                  <form
                    action={updateUserRoleAction}
                    className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end"
                  >
                    <input type="hidden" name="userId" value={record.id} />
                    <div className="space-y-2">
                      <Label htmlFor={`role-${record.id}`}>Role</Label>
                      <select
                        id={`role-${record.id}`}
                        name="role"
                        defaultValue={record.isAdmin ? Role.SA : record.role}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {Object.values(Role).map((role) => (
                          <option key={role} value={role}>
                            {role === Role.SA ? "Skill Advisor" : "Skill Competition Manager"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`admin-${record.id}`}>Admin access</Label>
                      <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
                        <input
                          id={`admin-${record.id}`}
                          name="isAdmin"
                          type="checkbox"
                          defaultChecked={record.isAdmin}
                        />
                        <span className="text-sm">Administrator</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Current status</Label>
                      <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        {record.isAdmin ? "Admin · Skill Advisor" : record.role === Role.SA ? "Skill Advisor" : "Skill Competition Manager"}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" variant="outline">
                        Save
                      </Button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Admins can edit competition settings and deliverable schedules and remain selectable as Skill Advisors.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance tools</CardTitle>
          <CardDescription>
            Recreate any missing deliverables for existing skills. This operation is idempotent and will not duplicate
            deliverables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={createMissingDeliverablesAction}>
            <Button type="submit" variant="outline">
              Create missing deliverables
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Use this if new skills were added before the catalog was introduced or if C1 changed significantly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
