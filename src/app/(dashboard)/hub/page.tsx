import { DeliverableState, ResourceVisibility, Role } from "@prisma/client";
import type { ResourceLink } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { Upload, Video, Receipt, ExternalLink, Vote, Monitor, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decorateDeliverable, DUE_SOON_THRESHOLD_DAYS } from "@/lib/deliverables";
import { getFeaturedResources } from "@/lib/resources";

const QUICK_ACTIONS = [
  {
    label: "Upload Evidence",
    description: "Add documents to your deliverables",
    href: "/skills",
    icon: Upload,
  },
  {
    label: "Join Meeting",
    description: "Access your upcoming meetings",
    href: "/hub/meetings",
    icon: Video,
  },
  {
    label: "Expenses",
    description: "Submit and track expenses",
    href: "/hub/kb",
    icon: Receipt,
  },
];

function canUserSeeResource(
  resource: ResourceLink,
  userRole: Role,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;

  switch (resource.visibility) {
    case ResourceVisibility.SA:
      return userRole === Role.SA;
    case ResourceVisibility.SCM:
      return userRole === Role.SCM;
    case ResourceVisibility.BOTH:
      return userRole === Role.SA || userRole === Role.SCM;
    default:
      return true;
  }
}

export default async function SkillsHubPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Support SA, SCM, and Skill Team users
  const skillsQuery =
    user.role === Role.SCM
      ? { scmId: user.id }
      : user.role === Role.SkillTeam
        ? { teamMembers: { some: { userId: user.id } } }
        : user.role === Role.SA
          ? { saId: user.id }
          : user.isAdmin
            ? {}
            : { saId: user.id };

  const skills = await prisma.skill.findMany({
    where: skillsQuery,
    include: {
      deliverables: true,
    },
    orderBy: { name: "asc" },
  });

  const decoratedSkills = skills.map((skill) => ({
    ...skill,
    deliverables: skill.deliverables
      .filter((d) => !d.isHidden)
      .map((d) => decorateDeliverable(d)),
  }));

  const now = new Date();
  const allDeliverables = decoratedSkills.flatMap((skill) =>
    skill.deliverables.map((deliverable) => ({ deliverable, skill }))
  );

  const myTasks = allDeliverables
    .filter(({ deliverable }) => {
      const state = deliverable.state;
      return (
        state === DeliverableState.Draft ||
        state === DeliverableState.InProgress ||
        state === DeliverableState.NotStarted
      );
    })
    .filter(({ deliverable }) => {
      const daysUntilDue = differenceInCalendarDays(deliverable.dueDate, now);
      return daysUntilDue <= DUE_SOON_THRESHOLD_DAYS || deliverable.isOverdue;
    })
    .sort((a, b) => a.deliverable.dueDate.getTime() - b.deliverable.dueDate.getTime())
    .slice(0, 10);

  const skillIds = decoratedSkills.map((s) => s.id);
  const recentActivity = skillIds.length
    ? await prisma.activityLog.findMany({
        where: { skillId: { in: skillIds } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          skill: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      })
    : [];

  const allFeaturedResources = await getFeaturedResources();
  const featuredResources = allFeaturedResources.filter((r) =>
    canUserSeeResource(r, user.role, user.isAdmin)
  );

  // Check for active CPW session
  const activeCPWSession = await prisma.cPWSession.findFirst({
    where: { isActive: true },
  });

  // Check if user is admin or secretariat (can manage CPW)
  const canManageCPW = user.isAdmin || user.role === Role.Secretariat;
  // Check if user is SCM (can vote)
  const canVoteCPW = user.role === Role.SCM;

  const nextMeeting = skillIds.length
    ? await prisma.meeting.findFirst({
        where: {
          skillId: { in: skillIds },
          startTime: { gte: now },
        },
        orderBy: { startTime: "asc" },
        include: { skill: { select: { name: true } } },
      })
    : null;

  const overdueCount = allDeliverables.filter(
    ({ deliverable }) => deliverable.isOverdue
  ).length;

  const dueSoonCount = allDeliverables.filter(({ deliverable }) => {
    if (deliverable.isOverdue || deliverable.state === DeliverableState.Validated) {
      return false;
    }
    const daysUntilDue = differenceInCalendarDays(deliverable.dueDate, now);
    return daysUntilDue >= 0 && daysUntilDue <= DUE_SOON_THRESHOLD_DAYS;
  }).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Skills Hub</h1>
        <p className="mt-2 text-muted-foreground">
          Your personalised workspace for managing skills and deliverables.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>My Skills</CardTitle>
            <CardDescription>Skills you manage</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{decoratedSkills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Overdue</CardTitle>
            <CardDescription>Requires attention</CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${overdueCount > 0 ? "text-destructive" : ""}`}
            >
              {overdueCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Due Soon</CardTitle>
            <CardDescription>Within 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dueSoonCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Next Meeting</CardTitle>
            <CardDescription>Upcoming event</CardDescription>
          </CardHeader>
          <CardContent>
            {nextMeeting ? (
              <p className="text-lg font-medium">
                {format(nextMeeting.startTime, "dd MMM")}
              </p>
            ) : (
              <p className="text-muted-foreground">No meetings</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CPW Section - Show for SCMs when active session, always show for Admin/Secretariat */}
      {(activeCPWSession && canVoteCPW) || canManageCPW ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              CPW Final Verdict
            </CardTitle>
            <CardDescription>
              {activeCPWSession
                ? `${activeCPWSession.name}${activeCPWSession.isLocked ? " - Voting Locked" : ""}`
                : "No active voting session"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {canVoteCPW && activeCPWSession && !activeCPWSession.isLocked && (
                <Button asChild>
                  <Link href="/cpw/vote">
                    <Vote className="mr-2 h-4 w-4" />
                    Cast Your Vote
                  </Link>
                </Button>
              )}
              {canManageCPW && (
                <>
                  <Button asChild variant={activeCPWSession ? "outline" : "default"}>
                    <Link href="/cpw/admin">
                      <Settings2 className="mr-2 h-4 w-4" />
                      {activeCPWSession ? "Manage Session" : "Create a Vote"}
                    </Link>
                  </Button>
                  {activeCPWSession && (
                    <Button asChild variant="outline">
                      <Link href="/cpw-display">
                        <Monitor className="mr-2 h-4 w-4" />
                        Open Display
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex flex-col items-center rounded-lg border p-4 text-center transition-colors hover:bg-muted"
                  >
                    <Icon className="h-8 w-8 text-primary" />
                    <p className="mt-2 font-medium">{action.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Featured Resources</CardTitle>
            <CardDescription>Quick links and guides</CardDescription>
          </CardHeader>
          <CardContent>
            {featuredResources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No featured resources yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {featuredResources.slice(0, 5).map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{resource.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/hub/kb">View all resources</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
          <CardDescription>
            Deliverables requiring your attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks due soon. Great work!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Deliverable</th>
                    <th className="pb-2 pr-4 font-medium">Skill</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {myTasks.map(({ deliverable, skill }) => {
                    const daysUntilDue = differenceInCalendarDays(
                      deliverable.dueDate,
                      now
                    );
                    return (
                      <tr key={deliverable.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <Link
                            href={`/skills/${skill.id}`}
                            className="font-medium hover:underline"
                          >
                            {deliverable.label}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {skill.name}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={
                              deliverable.isOverdue ? "destructive" : "outline"
                            }
                          >
                            {deliverable.state}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <span
                            className={
                              deliverable.isOverdue
                                ? "text-destructive"
                                : daysUntilDue <= 7
                                  ? "text-amber-600"
                                  : ""
                            }
                          >
                            {format(deliverable.dueDate, "dd MMM yyyy")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates on your skills</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent activity recorded.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-start gap-3 border-b pb-3 last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">
                        {activity.user.name ?? activity.user.email}
                      </span>{" "}
                      {activity.action}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.skill.name} ·{" "}
                      {format(activity.createdAt, "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
