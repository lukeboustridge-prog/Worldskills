import { Role } from "@prisma/client";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DUE_SOON_THRESHOLD_DAYS,
  decorateDeliverable,
  ensureOverdueNotifications,
  sortSkillsByRisk
} from "@/lib/deliverables";
import { formatDeliverableState } from "@/lib/utils";
import { getUserDisplayName } from "@/lib/users";

const DELIVERABLE_STATES = ["NotStarted", "Draft", "InProgress", "Finalised", "Uploaded", "Validated"] as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const isAdvisor = user.role === Role.SA || user.isAdmin;

  const skills = await prisma.skill.findMany({
    where: isAdvisor ? (user.isAdmin ? {} : { saId: user.id }) : { scmId: user.id },
    include: {
      deliverables: true,
      scm: true,
      sa: true
    },
    orderBy: { name: "asc" }
  });

  const decoratedSkills = skills.map((skill) => ({
    ...skill,
    deliverables: skill.deliverables.map((deliverable) => decorateDeliverable(deliverable))
  }));

  if (isAdvisor) {
    await Promise.all(
      decoratedSkills.map((skill) =>
        ensureOverdueNotifications({
          skillId: skill.id,
          deliverables: skill.deliverables,
          saId: skill.saId
        })
      )
    );
  }

  const allDeliverables = decoratedSkills.flatMap((skill) =>
    skill.deliverables.map((deliverable) => ({ deliverable, skill }))
  );

  const deliverableStateCounts = new Map<string, number>();
  DELIVERABLE_STATES.forEach((state) => deliverableStateCounts.set(state, 0));
  allDeliverables.forEach(({ deliverable }) => {
    deliverableStateCounts.set(
      deliverable.state,
      (deliverableStateCounts.get(deliverable.state) ?? 0) + 1
    );
  });

  const now = new Date();

  const overdueDeliverables = allDeliverables
    .filter(({ deliverable }) => deliverable.isOverdue)
    .sort((a, b) => b.deliverable.overdueByDays - a.deliverable.overdueByDays);

  const dueSoonDeliverables = allDeliverables
    .filter(({ deliverable }) => {
      if (deliverable.isOverdue || deliverable.state === "Validated") {
        return false;
      }
      const daysUntilDue = differenceInCalendarDays(deliverable.dueDate, now);
      return daysUntilDue >= 0 && daysUntilDue <= DUE_SOON_THRESHOLD_DAYS;
    })
    .sort((a, b) => a.deliverable.dueDate.getTime() - b.deliverable.dueDate.getTime());

  const advisorStatsMap = new Map<
    string,
    { id: string; name: string; total: number; validated: number; overdue: number; dueSoon: number }
  >();

  decoratedSkills.forEach((skill) => {
    const name = getUserDisplayName(skill.sa);
    const existing = advisorStatsMap.get(skill.saId) ?? {
      id: skill.saId,
      name,
      total: 0,
      validated: 0,
      overdue: 0,
      dueSoon: 0
    };

    existing.total += skill.deliverables.length;
    existing.validated += skill.deliverables.filter((deliverable) => deliverable.state === "Validated").length;
    existing.overdue += skill.deliverables.filter((deliverable) => deliverable.isOverdue).length;
    existing.dueSoon += skill.deliverables.filter((deliverable) => {
      if (deliverable.isOverdue || deliverable.state === "Validated") {
        return false;
      }
      const daysUntilDue = differenceInCalendarDays(deliverable.dueDate, now);
      return daysUntilDue >= 0 && daysUntilDue <= DUE_SOON_THRESHOLD_DAYS;
    }).length;

    advisorStatsMap.set(skill.saId, existing);
  });

  const advisorStats = Array.from(advisorStatsMap.values()).sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return b.overdue - a.overdue;
    }
    if (a.dueSoon !== b.dueSoon) {
      return b.dueSoon - a.dueSoon;
    }
    return a.name.localeCompare(b.name);
  });

  const topOverdueAdvisor = advisorStats.find((stat) => stat.overdue > 0);

  const riskOrderedSkills = sortSkillsByRisk([...decoratedSkills]);
  const skillsAtRisk = riskOrderedSkills
    .map((skill) => {
      const overdue = skill.deliverables.filter((deliverable) => deliverable.isOverdue);
      const dueSoon = skill.deliverables.filter((deliverable) => {
        if (deliverable.isOverdue || deliverable.state === "Validated") {
          return false;
        }
        const daysUntilDue = differenceInCalendarDays(deliverable.dueDate, now);
        return daysUntilDue >= 0 && daysUntilDue <= DUE_SOON_THRESHOLD_DAYS;
      });
      const validated = skill.deliverables.filter((deliverable) => deliverable.state === "Validated").length;
      const completionRate = skill.deliverables.length
        ? Math.round((validated / skill.deliverables.length) * 100)
        : 0;

      return { skill, overdue, dueSoon, completionRate };
    })
    .filter((entry) => entry.overdue.length > 0 || entry.dueSoon.length > 0)
    .slice(0, 6);

  const totalDeliverables = allDeliverables.length;
  const validatedDeliverables = deliverableStateCounts.get("Validated") ?? 0;
  const nextDueSoon = dueSoonDeliverables[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Portfolio metrics for your WorldSkills responsibilities with clear overdue and upcoming work.
          </p>
        </div>
        {isAdvisor ? (
          <Button asChild>
            <Link href="/skills">Manage skills</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Skills in scope</CardTitle>
            <CardDescription>Active skills you can access</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{decoratedSkills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Deliverables tracked</CardTitle>
            <CardDescription>Total scheduled items</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalDeliverables}</p>
            <p className="mt-1 text-xs text-muted-foreground">{validatedDeliverables} validated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Overdue deliverables</CardTitle>
            <CardDescription>Requires immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${overdueDeliverables.length > 0 ? "text-destructive" : "text-foreground"}`}>
              {overdueDeliverables.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {topOverdueAdvisor
                ? `Most overdue: ${topOverdueAdvisor.name}`
                : "All advisors are currently on track"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Due within 30 days</CardTitle>
            <CardDescription>Upcoming deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dueSoonDeliverables.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nextDueSoon
                ? `Next: ${format(nextDueSoon.deliverable.dueDate, "dd MMM yyyy")}`
                : "Nothing due in the next month"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deliverable status distribution</CardTitle>
            <CardDescription>Progress across every deliverable state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DELIVERABLE_STATES.map((state) => {
              const count = deliverableStateCounts.get(state) ?? 0;
              const percentage = totalDeliverables > 0 ? Math.round((count / totalDeliverables) * 100) : 0;
              const label = formatDeliverableState(state as (typeof DELIVERABLE_STATES)[number]);

              return (
                <div key={state} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{label}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${state === "Validated" ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advisor performance</CardTitle>
            <CardDescription>Completion rates and overdue counts by Skill Advisor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {advisorStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills are currently assigned to advisors.</p>
            ) : (
              advisorStats.map((stat) => {
                const completionRate = stat.total > 0 ? Math.round((stat.validated / stat.total) * 100) : 0;
                const barClass = stat.overdue > 0 ? "bg-destructive" : "bg-primary";

                return (
                  <div key={stat.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{stat.name}</span>
                      <span>{completionRate}% complete</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${completionRate}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className={stat.overdue > 0 ? "text-destructive" : undefined}>
                        {stat.overdue} overdue
                      </span>
                      <span>{stat.dueSoon} due soon</span>
                      <span>{stat.validated} validated</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Skills at risk</CardTitle>
            <CardDescription>Highest risk skills ordered by overdue work</CardDescription>
          </CardHeader>
          <CardContent>
            {skillsAtRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">All skills are currently on track.</p>
            ) : (
              <ul className="space-y-4">
                {skillsAtRisk.map(({ skill, overdue, dueSoon, completionRate }) => (
                  <li key={skill.id} className="rounded-md border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium leading-tight">{skill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          SA {getUserDisplayName(skill.sa)} · SCM {skill.scm ? getUserDisplayName(skill.scm) : "Unassigned"}
                        </p>
                      </div>
                      <Badge variant={overdue.length > 0 ? "destructive" : "outline"}>{completionRate}% complete</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                      <span className={overdue.length > 0 ? "text-destructive" : "text-muted-foreground"}>
                        {overdue.length} overdue
                      </span>
                      <span className="text-muted-foreground">{dueSoon.length} due soon</span>
                    </div>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link href={`/skills/${skill.id}`}>Open skill workspace</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
            <CardDescription>Deliverables due in the next {DUE_SOON_THRESHOLD_DAYS} days</CardDescription>
          </CardHeader>
          <CardContent>
            {dueSoonDeliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground">There are no upcoming deadlines in the next month.</p>
            ) : (
              <ul className="space-y-3">
                {dueSoonDeliverables.slice(0, 8).map(({ deliverable, skill }) => {
                  const daysUntilDue = differenceInCalendarDays(deliverable.dueDate, now);
                  const dueLabel =
                    daysUntilDue === 0
                      ? "Due today"
                      : daysUntilDue === 1
                      ? "Due tomorrow"
                      : `Due in ${daysUntilDue} days`;

                  return (
                    <li key={deliverable.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium leading-tight">{deliverable.label}</p>
                        <Badge variant="outline">{deliverable.cMonthLabel}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {skill.name} · SA {getUserDisplayName(skill.sa)} · Due {format(deliverable.dueDate, "dd MMM yyyy")}
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">{dueLabel}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
