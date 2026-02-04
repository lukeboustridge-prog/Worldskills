import { CPWVoteStatus } from "@prisma/client";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  Lock,
  LockOpen,
  Monitor,
  Plus,
  RotateCcw,
  StopCircle,
  UserCog,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdminOrSecretariat } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createSessionAction,
  lockSessionAction,
  unlockSessionAction,
  endSessionAction,
  resetVotesAction,
} from "./actions";

export default async function CPWAdminPage() {
  await requireAdminOrSecretariat();

  // Get active session
  const activeSession = await prisma.cPWSession.findFirst({
    where: { isActive: true },
    include: {
      votes: {
        include: {
          skill: {
            select: { name: true },
          },
        },
      },
    },
  });

  // Get all skills with SCM info
  const allSkills = await prisma.skill.findMany({
    orderBy: { name: "asc" },
    include: {
      scm: {
        select: { name: true, email: true },
      },
    },
  });
  const totalSkills = allSkills.length;

  // Find skills that haven't voted in the active session
  const votedSkillIds = new Set(activeSession?.votes.map((v) => v.skillId) ?? []);
  const pendingSkills = allSkills.filter((s) => !votedSkillIds.has(s.id));

  // Get past sessions
  const pastSessions = await prisma.cPWSession.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      _count: {
        select: { votes: true },
      },
    },
  });

  // Calculate stats for active session
  const greenVotes = activeSession?.votes.filter(
    (v) => v.status === CPWVoteStatus.GREEN
  ).length ?? 0;
  const redVotes = activeSession?.votes.filter(
    (v) => v.status === CPWVoteStatus.RED
  ).length ?? 0;
  const totalVotes = activeSession?.votes.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          CPW Voting Admin
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage Competition Preparation Week final verdict voting sessions.
        </p>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-4">
        <Button asChild variant="outline">
          <Link href="/cpw/vote" target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Voting Page
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cpw/display" target="_blank">
            <Monitor className="mr-2 h-4 w-4" />
            Open Display
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cpw/admin/proxy">
            <UserCog className="mr-2 h-4 w-4" />
            Proxy Voting
          </Link>
        </Button>
      </div>

      {/* Active Session */}
      {activeSession ? (
        <Card className="border-green-500/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {activeSession.name}
                  {activeSession.isLocked ? (
                    <Badge variant="outline" className="ml-2 border-amber-500 text-amber-500">
                      <Lock className="mr-1 h-3 w-3" />
                      Locked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2 border-green-500 text-green-500">
                      <LockOpen className="mr-1 h-3 w-3" />
                      Open
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Active session - Created {format(activeSession.createdAt, "PPp")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border bg-muted/50 p-4 text-center">
                <p className="text-3xl font-bold">{totalVotes}</p>
                <p className="text-sm text-muted-foreground">Votes Cast</p>
              </div>
              <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{greenVotes}</p>
                <p className="text-sm text-green-600">On Track</p>
              </div>
              <div className="rounded-lg border bg-red-50 dark:bg-red-950 p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{redVotes}</p>
                <p className="text-sm text-red-600">Issues</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4 text-center">
                <p className="text-3xl font-bold">{totalSkills - totalVotes}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Voting Progress</span>
                <span>{totalVotes} / {totalSkills} skills</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${(totalVotes / totalSkills) * 100}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {activeSession.isLocked ? (
                <form action={unlockSessionAction}>
                  <input type="hidden" name="sessionId" value={activeSession.id} />
                  <Button type="submit" variant="outline">
                    <LockOpen className="mr-2 h-4 w-4" />
                    Unlock Voting
                  </Button>
                </form>
              ) : (
                <form action={lockSessionAction}>
                  <input type="hidden" name="sessionId" value={activeSession.id} />
                  <Button type="submit" variant="default">
                    <Lock className="mr-2 h-4 w-4" />
                    Lock Voting
                  </Button>
                </form>
              )}

              <form action={resetVotesAction}>
                <input type="hidden" name="sessionId" value={activeSession.id} />
                <Button type="submit" variant="outline" className="text-amber-600 hover:text-amber-700">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset All Votes
                </Button>
              </form>

              <form action={endSessionAction}>
                <input type="hidden" name="sessionId" value={activeSession.id} />
                <Button type="submit" variant="destructive">
                  <StopCircle className="mr-2 h-4 w-4" />
                  End Session
                </Button>
              </form>
            </div>

            {/* Red Skills List */}
            {redVotes > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Issues Raised ({redVotes})</h3>
                <div className="space-y-2">
                  {activeSession.votes
                    .filter((v) => v.status === CPWVoteStatus.RED)
                    .map((vote) => (
                      <div
                        key={vote.id}
                        className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3"
                      >
                        <p className="font-medium text-red-700 dark:text-red-400">
                          {vote.skill.name}
                        </p>
                        {vote.comment && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                            {vote.comment}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Pending Skills List */}
            {pendingSkills.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Awaiting Vote ({pendingSkills.length})</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <p className="font-medium">{skill.name}</p>
                      <p className="text-sm text-muted-foreground">
                        SCM: {skill.scm?.name ?? skill.scm?.email ?? "Unassigned"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create New Session</CardTitle>
            <CardDescription>
              Start a new CPW voting session. This will deactivate any existing sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createSessionAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Session Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., CPW 2025 Final Verdict"
                  required
                />
              </div>
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Create Session
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Create New Session (when active exists) */}
      {activeSession && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Session</CardTitle>
            <CardDescription>
              End the current session and start a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createSessionAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Session Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., CPW 2025 Final Verdict"
                  required
                />
              </div>
              <Button type="submit" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create New Session
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Past Sessions */}
      {pastSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Sessions</CardTitle>
            <CardDescription>
              Historical CPW voting sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{session.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(session.createdAt, "PPp")} - {session._count.votes} votes
                    </p>
                  </div>
                  <Badge variant="outline">Ended</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
