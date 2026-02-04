import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { CPWDisplay } from "./cpw-display";

export const dynamic = "force-dynamic";

export default async function CPWDisplayPage() {
  // Find active session
  const activeSession = await prisma.cPWSession.findFirst({
    where: { isActive: true },
    include: {
      votes: {
        include: {
          skill: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!activeSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-24 w-24 text-amber-500" />
          <h1 className="mt-6 text-4xl font-bold text-white">No Active Session</h1>
          <p className="mt-4 text-xl text-slate-400">
            Waiting for a CPW voting session to begin...
          </p>
        </div>
      </div>
    );
  }

  // Get all skills
  const skills = await prisma.skill.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
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
    vote: votesMap.get(skill.id) ?? null,
  }));

  return (
    <CPWDisplay
      sessionId={activeSession.id}
      sessionName={activeSession.name}
      isLocked={activeSession.isLocked}
      skills={skillsWithVotes}
    />
  );
}
