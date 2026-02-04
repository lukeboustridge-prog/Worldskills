import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  try {
    const session = await prisma.cPWSession.findUnique({
      where: { id: sessionId },
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

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
      session.votes.map((v) => [v.skillId, { status: v.status, comment: v.comment }])
    );

    // Build skill data with vote status
    const skillsWithVotes = skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      vote: votesMap.get(skill.id) ?? null,
    }));

    return NextResponse.json({
      sessionId: session.id,
      sessionName: session.name,
      isLocked: session.isLocked,
      isActive: session.isActive,
      skills: skillsWithVotes,
    });
  } catch (error) {
    console.error("Failed to fetch CPW votes", error);
    return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
  }
}
