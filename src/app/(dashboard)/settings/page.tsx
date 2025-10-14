import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { DeliverableScheduleType, GateScheduleType, Role } from "@prisma/client";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth";
import { buildCMonthLabel, getDeliverableTemplates } from "@/lib/deliverables";
import { getGateTemplates } from "@/lib/gates";
import { getAppSettings } from "@/lib/settings";
import { hasGateTemplateCatalogSupport, hasInvitationTable } from "@/lib/schema-info";
import {
  createDeliverableTemplateAction,
  createGateTemplateAction,
  createInvitationAction,
  createMissingDeliverablesAction,
  saveCompetitionSettingsAction,
  updateDeliverableTemplateAction,
  updateGateTemplateAction,
  updateUserRoleAction
} from "./actions";
import { prisma } from "@/lib/prisma";
import { getUserDisplayName } from "@/lib/users";

const ROLE_LABELS: Record<Role, string> = {
  [Role.Pending]: "No current permissions",
  [Role.SA]: "Skill Advisor",
  [Role.SCM]: "Skill Competition Manager",
  [Role.Secretariat]: "Secretariat"
};

function formatDateInput(value: Date | null | undefined) {
  if (!value) return "";
  return format(value, "yyyy-MM-dd");
}

function parseCountParam(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, description, children, defaultOpen = false }: CollapsibleSectionProps) {
  return (
    <details className="group rounded-lg border bg-card" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-4 text-left font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="space-y-1">
          <p className="text-lg font-semibold">{title}</p>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-input">
          <Plus className="h-4 w-4 group-open:hidden" aria-hidden="true" />
          <Minus className="hidden h-4 w-4 group-open:block" aria-hidden="true" />
        </div>
      </summary>
      <div className="border-t">
        <div className="space-y-6 p-6">{children}</div>
      </div>
    </details>
  );
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
  const createdCount = parseCountParam(
    typeof searchParams?.created === "string" ? searchParams.created : undefined
  );
  const templateCreatedKey = typeof searchParams?.templateCreated === "string" ? searchParams.templateCreated : null;
  const templateUpdatedKey = typeof searchParams?.templateUpdated === "string" ? searchParams.templateUpdated : null;
  const addedCount = parseCountParam(
    typeof searchParams?.added === "string" ? searchParams.added : undefined
  );
  const gateTemplateCreatedKey =
    typeof searchParams?.gateTemplateCreated === "string" ? searchParams.gateTemplateCreated : null;
  const gateTemplateUpdatedKey =
    typeof searchParams?.gateTemplateUpdated === "string" ? searchParams.gateTemplateUpdated : null;
  const gatesAddedCount = parseCountParam(
    typeof searchParams?.gatesAdded === "string" ? searchParams.gatesAdded : undefined
  );
  const gatesCreatedCount = parseCountParam(
    typeof searchParams?.gatesCreated === "string" ? searchParams.gatesCreated : undefined
  );
  const userUpdated = typeof searchParams?.userUpdated === "string";
  const userQuery = typeof searchParams?.userQuery === "string" ? searchParams.userQuery.trim() : "";
  const inviteCreated = typeof searchParams?.inviteCreated === "string";
  const inviteToken = typeof searchParams?.inviteToken === "string" ? searchParams.inviteToken : null;
  const inviteEmail = typeof searchParams?.inviteEmail === "string" ? searchParams.inviteEmail : null;
  const inviteLink = inviteToken ? `/register?token=${inviteToken}` : null;
  const inviteError = typeof searchParams?.inviteError === "string" ? searchParams.inviteError : null;
  const userErrorMessage = typeof searchParams?.userError === "string" ? searchParams.userError : null;
  const errorMessages = [
    inviteError ? { id: "invite-error", message: inviteError } : null,
    userErrorMessage ? { id: "user-error", message: userErrorMessage } : null
  ].filter((entry): entry is { id: string; message: string } => entry !== null);

  const gateTemplateSupportPromise = hasGateTemplateCatalogSupport();
  const invitationSupportPromise = hasInvitationTable();

  const [templates, gateTemplates, users, invitationsSupported] = await Promise.all([
    getDeliverableTemplates(),
    getGateTemplates(),
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
    }),
    invitationSupportPromise
  ]);

  const gateTemplatesSupported = await gateTemplateSupportPromise;

  const pendingUsers = users.filter((record) => !record.isAdmin && record.role === Role.Pending);
  const registeredUsers = users.filter((record) => record.isAdmin || record.role !== Role.Pending);

  const renderUserCard = (record: (typeof users)[number]) => {
    const isPending = !record.isAdmin && record.role === Role.Pending;
    const statusLabel = record.isAdmin ? "Admin · Skill Advisor" : ROLE_LABELS[record.role];
    const statusClasses = isPending
      ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      : "rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground";

    return (
      <div
        key={record.id}
        className={`rounded-md border p-4 ${isPending ? "border-amber-300 border-dashed bg-amber-50/60" : ""}`}
      >
        <div className="mb-3">
          <p className="font-medium">{getUserDisplayName(record)}</p>
          <p className="text-xs text-muted-foreground">{record.email}</p>
          {isPending ? (
            <p className="mt-1 text-xs text-amber-700">
              Awaiting an administrator to assign a role.
            </p>
          ) : null}
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
                  {ROLE_LABELS[role]}
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
            <div className={statusClasses}>{statusLabel}</div>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="outline">
              Save
            </Button>
          </div>
        </form>
      </div>
    );
  };

  const invitations = invitationsSupported
    ? await prisma.invitation.findMany({
        where: { acceptedAt: null },
        orderBy: { createdAt: "desc" }
      })
    : [];

  const invitationRoleOptions = Object.values(Role).filter((role) => role !== Role.Pending);

  const createdTemplate = templateCreatedKey
    ? templates.find((template) => template.key === templateCreatedKey)
    : null;
  const updatedTemplate = templateUpdatedKey
    ? templates.find((template) => template.key === templateUpdatedKey)
    : null;
  const createdGateTemplate = gateTemplateCreatedKey
    ? gateTemplates.find((template) => template.key === gateTemplateCreatedKey)
    : null;
  const updatedGateTemplate = gateTemplateUpdatedKey
    ? gateTemplates.find((template) => template.key === gateTemplateUpdatedKey)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground">
          Manage competition dates, standard deliverables and gates, user access, and invitations.
        </p>
      </div>

      <div className="space-y-4">
        {errorMessages.map((error) => (
          <div
            key={error.id}
            className="rounded-md border border-destructive/60 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error.message}
          </div>
        ))}
        {updated ? (
          <div className="rounded-md border border-green-400 bg-green-50 p-4 text-sm text-green-900">
            Competition settings saved successfully.{" "}
            {recalculated ? "All deliverable due dates were recalculated." : null}
          </div>
        ) : null}
        {backfilled ? (
          <div className="rounded-md border border-blue-400 bg-blue-50 p-4 text-sm text-blue-900">
            Missing deliverables{gatesCreatedCount > 0 ? " and gates" : ""} have been created for all skills. {createdCount} new deliverables were added.
            {gatesCreatedCount > 0 ? ` ${gatesCreatedCount} gates were added.` : ""}
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
        {gateTemplatesSupported && gateTemplateCreatedKey ? (
          <div className="rounded-md border border-orange-400 bg-orange-50 p-4 text-sm text-orange-900">
            {createdGateTemplate ? `Added ${createdGateTemplate.name}` : `Added ${gateTemplateCreatedKey}`} to the gate
            catalog.{" "}
            {gatesAddedCount > 0 ? `Created ${gatesAddedCount} gates across existing skills.` : ""}
          </div>
        ) : null}
        {gateTemplatesSupported && gateTemplateUpdatedKey ? (
          <div className="rounded-md border border-rose-400 bg-rose-50 p-4 text-sm text-rose-900">
            Gate template {updatedGateTemplate ? updatedGateTemplate.name : gateTemplateUpdatedKey} updated. Existing gates now
            reflect the new schedule.
          </div>
        ) : null}
        {invitationsSupported && inviteCreated && inviteLink ? (
          <div className="rounded-md border border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-900">
            Invitation ready for {inviteEmail ?? "the recipient"}. Share {" "}
            <code className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-xs">{inviteLink}</code>
            {" "}with them to complete registration within 7 days.
          </div>
        ) : null}
        {userUpdated ? (
          <div className="rounded-md border border-slate-400 bg-slate-50 p-4 text-sm text-slate-900">
            User permissions updated successfully.
          </div>
        ) : null}
      </div>

      <CollapsibleSection
        title="Competition timeline"
        description="Update the competition name, key dates, and confirm recalculation when adjusting the C1 start date."
        defaultOpen={updated || recalculated}
      >
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
              Deliverable due dates are derived from the competition start date. To adjust individual skills, update C1 here and
              confirm the recalculation.
            </p>
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Save settings</Button>
          </div>
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        title="Standard deliverable catalog"
        description="Every skill is seeded with these deliverables. Adjust labels, offsets, and ordering to match the latest guidance."
        defaultOpen={Boolean(templateCreatedKey || templateUpdatedKey)}
      >
        <form
          action={createDeliverableTemplateAction}
          className="grid gap-4 rounded-md border border-dashed p-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end"
        >
          <div className="space-y-2 md:col-span-2 xl:col-span-2">
            <Label htmlFor="new-label">New deliverable label</Label>
            <Input id="new-label" name="label" placeholder="WorldSkills Orientation" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-deliverable-schedule">Schedule type</Label>
            <select
              id="new-deliverable-schedule"
              name="scheduleType"
              defaultValue="cmonth"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="cmonth">C-month offset</option>
              <option value="calendar">Calendar date</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-offset">Months before C1</Label>
            <Input id="new-offset" name="offsetMonths" type="number" min={0} max={48} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-calendar-date">Calendar due date</Label>
            <Input id="new-calendar-date" name="calendarDueDate" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-position">Position</Label>
            <Input id="new-position" name="position" type="number" min={1} placeholder={`${templates.length + 1}`} />
          </div>
          <div className="space-y-2 md:col-span-2 xl:col-span-2">
            <Label htmlFor="new-key">Key (optional)</Label>
            <Input id="new-key" name="key" placeholder="OrientationWorkshop" />
          </div>
          <div className="flex items-end md:col-span-2 xl:col-span-1 xl:justify-end">
            <Button type="submit" className="w-full xl:w-auto">
              Add deliverable
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.key} className="rounded-md border p-4">
              <form
                action={updateDeliverableTemplateAction}
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end"
              >
                <input type="hidden" name="key" value={template.key} />
                <div className="space-y-2 md:col-span-2 xl:col-span-2">
                  <Label htmlFor={`label-${template.key}`}>Label</Label>
                  <Input id={`label-${template.key}`} name="label" defaultValue={template.label} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`schedule-${template.key}`}>Schedule type</Label>
                  <select
                    id={`schedule-${template.key}`}
                    name="scheduleType"
                    defaultValue={
                      template.scheduleType === DeliverableScheduleType.Calendar ? "calendar" : "cmonth"
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="cmonth">C-month offset</option>
                    <option value="calendar">Calendar date</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`offset-${template.key}`}>Months before C1</Label>
                  <Input
                    id={`offset-${template.key}`}
                    name="offsetMonths"
                    type="number"
                    min={0}
                    max={48}
                    defaultValue={template.offsetMonths ?? undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`calendar-${template.key}`}>Calendar due date</Label>
                  <Input
                    id={`calendar-${template.key}`}
                    name="calendarDueDate"
                    type="date"
                    defaultValue={formatDateInput(template.calendarDueDate)}
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
                <div className="flex items-end md:col-span-2 xl:col-span-1 xl:justify-end">
                  <Button type="submit" variant="outline" className="w-full xl:w-auto">
                    Save
                  </Button>
                </div>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                Key: <span className="font-mono">{template.key}</span> ·{' '}
                {template.scheduleType === DeliverableScheduleType.CMonth && template.offsetMonths != null
                  ? buildCMonthLabel(template.offsetMonths)
                  : template.calendarDueDate
                    ? `Calendar date · ${format(template.calendarDueDate, "dd MMM yyyy")}`
                    : "Schedule pending"}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Gate templates"
        description="Define the standard gates that are created for every skill."
        defaultOpen={Boolean(gateTemplateCreatedKey || gateTemplateUpdatedKey) || !gateTemplatesSupported}
      >
        {gateTemplatesSupported ? (
          <>
            <form
              action={createGateTemplateAction}
              className="grid gap-4 rounded-md border border-dashed p-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end"
            >
              <div className="space-y-2 md:col-span-2 xl:col-span-2">
                <Label htmlFor="gate-name">New gate name</Label>
                <Input id="gate-name" name="name" placeholder="Validation workshop" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-schedule">Schedule type</Label>
                <select
                  id="gate-schedule"
                  name="scheduleType"
                  defaultValue="cmonth"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="cmonth">C-month offset</option>
                  <option value="calendar">Calendar date</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-offset">Months before C1</Label>
                <Input id="gate-offset" name="offsetMonths" type="number" min={0} max={48} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-calendar">Calendar due date</Label>
                <Input id="gate-calendar" name="calendarDueDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-position">Position</Label>
                <Input
                  id="gate-position"
                  name="position"
                  type="number"
                  min={1}
                  placeholder={`${gateTemplates.length + 1}`}
                />
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-2">
                <Label htmlFor="gate-key">Key (optional)</Label>
                <Input id="gate-key" name="key" placeholder="ValidationGate" />
              </div>
              <div className="flex items-end md:col-span-2 xl:col-span-1 xl:justify-end">
                <Button type="submit" className="w-full xl:w-auto">
                  Add gate
                </Button>
              </div>
            </form>

            <div className="space-y-4">
              {gateTemplates.map((template) => (
                <div key={template.key} className="rounded-md border p-4">
                  <form
                    action={updateGateTemplateAction}
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end"
                  >
                    <input type="hidden" name="key" value={template.key} />
                    <div className="space-y-2 md:col-span-2 xl:col-span-2">
                      <Label htmlFor={`gate-name-${template.key}`}>Name</Label>
                      <Input id={`gate-name-${template.key}`} name="name" defaultValue={template.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`gate-schedule-${template.key}`}>Schedule type</Label>
                        <select
                          id={`gate-schedule-${template.key}`}
                          name="scheduleType"
                          defaultValue={
                            template.scheduleType === GateScheduleType.Calendar ? "calendar" : "cmonth"
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="cmonth">C-month offset</option>
                          <option value="calendar">Calendar date</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`gate-offset-${template.key}`}>Months before C1</Label>
                        <Input
                          id={`gate-offset-${template.key}`}
                          name="offsetMonths"
                          type="number"
                          min={0}
                          max={48}
                          defaultValue={template.offsetMonths ?? undefined}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`gate-calendar-${template.key}`}>Calendar due date</Label>
                        <Input
                          id={`gate-calendar-${template.key}`}
                          name="calendarDueDate"
                          type="date"
                          defaultValue={formatDateInput(template.calendarDueDate)}
                        />
                      </div>
                    <div className="space-y-2">
                      <Label htmlFor={`gate-position-${template.key}`}>Position</Label>
                      <Input
                        id={`gate-position-${template.key}`}
                        name="position"
                        type="number"
                        min={1}
                        defaultValue={template.position}
                        required
                      />
                    </div>
                    <div className="flex items-end md:col-span-2 xl:col-span-1 xl:justify-end">
                      <Button type="submit" variant="outline" className="w-full xl:w-auto">
                        Save
                      </Button>
                    </div>
                  </form>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Key: <span className="font-mono">{template.key}</span> ·{' '}
                    {template.scheduleType === GateScheduleType.CMonth && template.offsetMonths != null
                      ? buildCMonthLabel(template.offsetMonths)
                      : template.calendarDueDate
                        ? `Calendar date · ${format(template.calendarDueDate, "dd MMM yyyy")}`
                        : "Schedule pending"}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Gate templates will be available once the latest database migration has completed. Existing gates continue to use
            the default schedule in the meantime.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="User management"
        description="Adjust base roles and admin access. Admins automatically appear in Skill Advisor lists."
        defaultOpen={userUpdated || userQuery.length > 0}
      >
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
          <div className="space-y-8">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                No current permissions
              </h3>
              {pendingUsers.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  All registered users currently have role assignments.
                </p>
              ) : (
                <div className="mt-3 space-y-4">{pendingUsers.map((record) => renderUserCard(record))}</div>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Registered users
              </h3>
              {registeredUsers.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No users with assigned permissions match the current search.
                </p>
              ) : (
                <div className="mt-3 space-y-4">{registeredUsers.map((record) => renderUserCard(record))}</div>
              )}
            </section>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Admins can edit competition settings and deliverable schedules and remain selectable as Skill Advisors.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        title="User invitations"
        description="Invite new teammates with the correct role and permissions pre-configured."
        defaultOpen={inviteCreated || !invitationsSupported}
      >
        {invitationsSupported ? (
          <>
            <form
              action={createInvitationAction}
              className="grid gap-4 rounded-md border border-dashed p-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end"
            >
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" name="name" placeholder="Alex Advisor" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" name="email" type="email" placeholder="alex@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  name="role"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={Role.SCM}
                >
                      {invitationRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-admin">Permissions</Label>
                <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
                  <input id="invite-admin" name="isAdmin" type="checkbox" />
                  <span className="text-sm">Administrator access</span>
                </div>
              </div>
              <div className="flex items-end">
                <Button type="submit">Create invitation</Button>
              </div>
            </form>

            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invitations yet.</p>
            ) : (
              <div className="space-y-4">
                {invitations.map((invitation) => {
                  const expires = new Date(invitation.expiresAt);
                  const isExpired = expires.getTime() < Date.now();
                  const invitePath = `/register?token=${invitation.token}`;
                  return (
                    <div key={invitation.id} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{invitation.name}</p>
                          <p className="text-xs text-muted-foreground">{invitation.email}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Expires {format(expires, "dd MMM yyyy")}
                          {isExpired ? <span className="ml-1 text-destructive">(Expired)</span> : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))]">
                        <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          Role: {ROLE_LABELS[invitation.role]}
                        </div>
                        <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          Permissions: {invitation.isAdmin ? "Administrator" : "Standard"}
                        </div>
                        <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          Link:
                          <code className="ml-2 inline-block rounded bg-muted px-2 py-0.5 text-xs">{invitePath}</code>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Invitations will be available once the database migration that adds the invitation table has completed.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Maintenance tools"
        description="Recreate any missing deliverables or gates for existing skills."
        defaultOpen={backfilled}
      >
        <form action={createMissingDeliverablesAction} className="inline">
          <Button type="submit" variant="outline">
            Create missing deliverables and gates
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Use this if new skills were added before the catalogs were introduced or if C1 changed significantly.
        </p>
      </CollapsibleSection>
    </div>
  );
}
