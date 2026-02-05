import { CPWVoteStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VoteForm } from "./vote-form";

export default async function CPWVotePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Find active session
  const activeSession = await prisma.cPWSession.findFirst({
    where: { isActive: true },
    include: {
      votes: true,
    },
  });

  if (!activeSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-semibold">No Active Session</h1>
          <p className="mt-2 text-muted-foreground">
            There is no CPW voting session currently active.
          </p>
        </div>
      </div>
    );
  }

  if (activeSession.isLocked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="mt-4 text-2xl font-semibold">Voting Complete</h1>
          <p className="mt-2 text-muted-foreground">
            Voting has been locked for this session. Thank you for participating!
          </p>
        </div>
      </div>
    );
  }

  // Find user's skill (as SCM)
  const userSkill = await prisma.skill.findFirst({
    where: { scmId: user.id },
  });

  // For admins without a skill, show a message
  if (!userSkill && user.isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
          <h1 className="mt-4 text-2xl font-semibold">Admin View</h1>
          <p className="mt-2 text-muted-foreground">
            You are an admin but not assigned as SCM to any skill.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Go to the <a href="/cpw/admin" className="text-primary hover:underline">admin panel</a> to manage the session.
          </p>
        </div>
      </div>
    );
  }

  if (!userSkill) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <XCircle className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You are not assigned as an SCM to any skill.
          </p>
        </div>
      </div>
    );
  }

  // Find existing vote for this skill in this session
  const existingVote = activeSession.votes.find(
    (v) => v.skillId === userSkill.id
  );

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Skill Preparedness Vote (Green / Red)</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {activeSession.name}
          </p>
        </div>

        <div className="mt-8 rounded-xl border bg-card p-6 shadow-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Your Skill</p>
            <h2 className="mt-1 text-2xl font-semibold">{userSkill.name}</h2>
          </div>

          <div className="mt-6">
            <VoteForm
              sessionId={activeSession.id}
              skillId={userSkill.id}
              existingVote={existingVote ? {
                status: existingVote.status,
                comment: existingVote.comment,
              } : null}
            />
          </div>

          {existingVote && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                You can change your vote until voting is locked.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
