import { CPWVoteStatus } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminOrSecretariat } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProxyVoteList } from "./proxy-vote-list";

export default async function ProxyVotePage() {
  await requireAdminOrSecretariat();

  // Find active session
  const activeSession = await prisma.cPWSession.findFirst({
    where: { isActive: true },
    include: {
      votes: true,
    },
  });

  if (!activeSession) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/cpw/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to CPW Admin
            </Link>
          </Button>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-4 text-2xl font-semibold">No Active Session</h1>
            <p className="mt-2 text-muted-foreground">
              Create a voting session first in the admin panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeSession.isLocked) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/cpw/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to CPW Admin
            </Link>
          </Button>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
            <h1 className="mt-4 text-2xl font-semibold">Voting Locked</h1>
            <p className="mt-2 text-muted-foreground">
              Voting is locked for this session. Unlock it in the admin panel to make changes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get all skills with their SCM
  const skills = await prisma.skill.findMany({
    orderBy: { name: "asc" },
    include: {
      scm: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Map votes by skill ID
  const votesMap = new Map(
    activeSession.votes.map((v) => [v.skillId, { status: v.status, comment: v.comment }])
  );

  // Build skill data with vote status
  const skillsWithVotes = skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    scmName: skill.scm?.name ?? skill.scm?.email ?? "Unassigned",
    vote: votesMap.get(skill.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/cpw/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to CPW Admin
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Proxy Voting</h1>
        <p className="mt-2 text-muted-foreground">
          Vote on behalf of absent SCMs for {activeSession.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Skills</CardTitle>
          <CardDescription>
            Click on a skill to cast or update a vote on behalf of the SCM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProxyVoteList
            sessionId={activeSession.id}
            skills={skillsWithVotes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
