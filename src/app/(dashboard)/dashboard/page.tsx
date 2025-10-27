import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { differenceInCalendarDays, differenceInMinutes, format } from "date-fns";

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
import { getUserDisplayName } from "@/lib/users";

const HOURS_PER_MILLISECOND = 1000 * 60 * 60;

function formatHours(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  if (value >= 48) {
    return `${(value / 24).toFixed(1)}d`;
  }

  if (value >= 1) {
    return `${value.toFixed(1)}h`;
  }

  const minutes = Math.round(value * 60);
  return `${minutes}m`;
}

function formatDurationFromMinutes(minutes: number) {
  if (minutes <= 0) {
    return "less than 1m";
  }

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const remainingMinutes = Math.round(minutes % 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (parts.length === 0 || (parts.length === 1 && remainingMinutes > 0 && days === 0)) {
    if (remainingMinutes > 0) {
      parts.push(`${remainingMinutes}m`);
    }
  }

  return parts.slice(0, 2).join(" ");
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { scope?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && user.role === Role.Pending) {
    redirect("/awaiting-access");
  }

  const canAccessDashboard =
    user.isAdmin || user.role === Role.SA || user.role === Role.Secretariat;
  if (!canAccessDashboard) {
    const fallbackSkill = await prisma.skill.findFirst({
      where: { scmId: user.id },
      select: { id: true }
    });

    if (fallbackSkill) {
      redirect(`/skills/${fallbackSkill.id}`);
    }

    redirect("/skills");
  }

  const canFilterToMine = user.isAdmin || user.role === Role.SA;
  const requestedScope = searchParams?.scope === "mine" ? "mine" : "all";
  const scope = canFilterToMine && requestedScope === "mine" ? "mine" : "all";

  const skills = await prisma.skill.findMany({
    where: scope === "mine" ? { saId: user.id } : {},
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

  const canManageSkills = user.isAdmin || user.role === Role.SA;
  const canViewSkillsList = user.isAdmin || user.role === Role.SA || user.role === Role.Secretariat;
  const skillsButtonLabel = user.role === Role.Secretariat && !user.isAdmin ? "View skills" : "Manage skills";

  if (canManageSkills) {
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

  const nextDueSoon = dueSoonDeliverables[0];

  const skillIds = decoratedSkills.map((skill) => skill.id);
  const messages = skillIds.length
    ? await prisma.message.findMany({
        where: { skillId: { in: skillIds } },
        orderBy: { createdAt: "asc" }
      })
    : [];

  const messagesBySkill = new Map<string, typeof messages>();
  for (const message of messages) {
    const list = messagesBySkill.get(message.skillId) ?? [];
    list.push(message);
    messagesBySkill.set(message.skillId, list);
  }

  let totalResponseMs = 0;
  let totalResponseCount = 0;
  let awaitingResponseCount = 0;
  const awaitingResponses: {
    skill: (typeof decoratedSkills)[number];
    pendingMessage: (typeof messages)[number];
    ageMinutes: number;
  }[] = [];

  const scmResponseStatsMap = new Map<
    string,
    { id: string; name: string; responses: number; totalMs: number; awaiting: number }
  >();

  const ensureScmStat = (skill: (typeof decoratedSkills)[number]) => {
    if (!skill.scmId || !skill.scm) {
      return null;
    }

    let stat = scmResponseStatsMap.get(skill.scmId);
    if (!stat) {
      stat = {
        id: skill.scmId,
        name: getUserDisplayName(skill.scm),
        responses: 0,
        totalMs: 0,
        awaiting: 0
      };
      scmResponseStatsMap.set(skill.scmId, stat);
    }

    return stat;
  };

  for (const skill of decoratedSkills) {
    const conversation = messagesBySkill.get(skill.id) ?? [];
    let pendingSaMessage: (typeof conversation)[number] | null = null;

    for (const message of conversation) {
      const isFromSa = message.authorId === skill.saId;
      const isFromScm = Boolean(skill.scmId && message.authorId === skill.scmId);

      if (isFromSa) {
        pendingSaMessage = message;
        continue;
      }

      if (isFromScm) {
        if (pendingSaMessage) {
          const responseMs = Math.max(
            0,
            message.createdAt.getTime() - pendingSaMessage.createdAt.getTime()
          );
          totalResponseMs += responseMs;
          totalResponseCount += 1;

          const stat = ensureScmStat(skill);
          if (stat) {
            stat.responses += 1;
            stat.totalMs += responseMs;
          }
        }

        pendingSaMessage = null;
        continue;
      }
    }

    if (pendingSaMessage && skill.scmId) {
      awaitingResponseCount += 1;
      const ageMinutes = Math.max(0, differenceInMinutes(now, pendingSaMessage.createdAt));
      awaitingResponses.push({ skill, pendingMessage: pendingSaMessage, ageMinutes });

      const stat = ensureScmStat(skill);
      if (stat) {
        stat.awaiting += 1;
      }
    }
  }

  const averageScmResponseHours =
    totalResponseCount > 0 ? totalResponseMs / totalResponseCount / HOURS_PER_MILLISECOND : null;

  const awaitingResponsesList = awaitingResponses
    .slice()
    .sort((a, b) => b.ageMinutes - a.ageMinutes)
    .slice(0, 6);

  const scmResponseStats = Array.from(scmResponseStatsMap.values())
    .map((stat) => ({
      ...stat,
      averageHours: stat.responses > 0 ? stat.totalMs / stat.responses / HOURS_PER_MILLISECOND : null
    }))
    .sort((a, b) => {
      if (a.awaiting !== b.awaiting) {
        return b.awaiting - a.awaiting;
      }

      const aAvg = a.averageHours ?? -1;
      const bAvg = b.averageHours ?? -1;
      return bAvg - aAvg;
    });

  const maxAverageHours = scmResponseStats.reduce((max, stat) => {
    if (stat.averageHours && stat.averageHours > max) {
      return stat.averageHours;
    }
    return max;
  }, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Portfolio metrics for your WorldSkills responsibilities with clear overdue and upcoming work.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-1 rounded-md border bg-background p-1">
            <Button
              variant={scope === "all" ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link href="/dashboard">All skills</Link>
            </Button>
            {canFilterToMine ? (
              <Button
                variant={scope === "mine" ? "default" : "ghost"}
                size="sm"
                asChild
              >
                <Link href="/dashboard?scope=mine">My skills</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                My skills
              </Button>
            )}
          </div>
          {canViewSkillsList ? (
            <Button asChild variant="outline">
              <Link href="/skills">{skillsButtonLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Average SCM response</CardTitle>
            <CardDescription>Time to respond to Skill Advisor messages</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatHours(averageScmResponseHours)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalResponseCount > 0
                ? `${totalResponseCount} responses analysed`
                : "No SCM responses recorded yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Awaiting SCM replies</CardTitle>
            <CardDescription>Conversations needing action</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{awaitingResponseCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {awaitingResponsesList[0]
                ? `Oldest wait: ${formatDurationFromMinutes(awaitingResponsesList[0].ageMinutes)}`
                : "All SA messages have been answered"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Skills at risk</CardTitle>
          <CardDescription>Highest risk skills ordered by overdue work</CardDescription>
        </CardHeader>
        <CardContent>
          {skillsAtRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">All skills are currently on track.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <div className="grid gap-4 xl:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>SCM response performance</CardTitle>
            <CardDescription>Average replies and outstanding follow-ups by manager</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scmResponseStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Skill Competition Manager conversations yet.</p>
            ) : (
              scmResponseStats.map((stat) => {
                const widthPercent = stat.averageHours && maxAverageHours > 0
                  ? Math.min(100, Math.round((stat.averageHours / maxAverageHours) * 100))
                  : 0;

                return (
                  <div key={stat.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{stat.name}</span>
                      <span>{formatHours(stat.averageHours)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${widthPercent}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>{stat.responses} responses</span>
                      <span className={stat.awaiting > 0 ? "text-destructive" : undefined}>
                        {stat.awaiting} awaiting reply
                      </span>
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
            <CardTitle>Awaiting SCM replies</CardTitle>
            <CardDescription>Most urgent conversations awaiting manager responses</CardDescription>
          </CardHeader>
          <CardContent>
            {awaitingResponsesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">All Skill Advisor messages have received responses.</p>
            ) : (
              <ul className="space-y-3">
                {awaitingResponsesList.map(({ skill, pendingMessage, ageMinutes }) => (
                  <li key={pendingMessage.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium leading-tight">{skill.name}</p>
                      <Badge variant="outline">Waiting {formatDurationFromMinutes(ageMinutes)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      SA {getUserDisplayName(skill.sa)} · SCM {skill.scm ? getUserDisplayName(skill.scm) : "Unassigned"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">“{pendingMessage.body.slice(0, 140)}{pendingMessage.body.length > 140 ? "…" : ""}”</p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link href={`/skills/${skill.id}`}>Open conversation</Link>
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
