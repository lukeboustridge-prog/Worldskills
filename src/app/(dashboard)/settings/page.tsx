import { redirect } from "next/navigation";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { STANDARD_DELIVERABLES, buildCMonthLabel } from "@/lib/deliverables";
import { getAppSettings } from "@/lib/settings";
import { createMissingDeliverablesAction, saveCompetitionSettingsAction } from "./actions";

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
  if (user.role !== "Admin") {
    redirect("/dashboard");
  }

  const settings = await getAppSettings();
  const keyDatesValue = settings?.keyDates ? JSON.stringify(settings.keyDates, null, 2) : "";
  const updated = typeof searchParams?.updated === "string";
  const recalculated = typeof searchParams?.recalculated === "string";
  const backfilled = typeof searchParams?.backfilled === "string";
  const createdCount = typeof searchParams?.created === "string" ? Number(searchParams.created) : 0;

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
            Each skill automatically receives every deliverable below. Due dates are scheduled relative to C1 using the
            C-Month offset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>C-Month</TableHead>
                <TableHead>Months before C1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STANDARD_DELIVERABLES.map((deliverable) => (
                <TableRow key={deliverable.key}>
                  <TableCell>{deliverable.label}</TableCell>
                  <TableCell>{buildCMonthLabel(deliverable.offsetMonths)}</TableCell>
                  <TableCell>{deliverable.offsetMonths}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
