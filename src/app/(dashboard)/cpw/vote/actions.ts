"use server";

import { CPWVoteStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, requireAdminOrSecretariat } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const voteSchema = z.object({
  sessionId: z.string().min(1),
  skillId: z.string().min(1),
  status: z.nativeEnum(CPWVoteStatus),
  comment: z.string().optional(),
}).refine(
  (data) => data.status === CPWVoteStatus.GREEN || (data.comment && data.comment.trim().length > 0),
  { message: "Comment is required for red status", path: ["comment"] }
);

export async function submitVoteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const sessionId = formData.get("sessionId") as string;
  const skillId = formData.get("skillId") as string;
  const status = formData.get("status") as CPWVoteStatus;
  const comment = formData.get("comment") as string | null;

  const parsed = voteSchema.safeParse({
    sessionId,
    skillId,
    status,
    comment: comment || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid vote data" };
  }

  // Check if session exists and is active/not locked
  const session = await prisma.cPWSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { error: "Session not found" };
  }

  if (!session.isActive) {
    return { error: "This session is no longer active" };
  }

  if (session.isLocked) {
    return { error: "Voting is locked for this session" };
  }

  // Verify user is SCM for this skill
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Allow SCM, Admin, or Secretariat to vote
  const canVote = skill.scmId === user.id || user.isAdmin || user.role === Role.Secretariat;
  if (!canVote) {
    return { error: "You are not authorized to vote for this skill" };
  }

  // Upsert the vote
  try {
    await prisma.cPWVote.upsert({
      where: {
        sessionId_skillId: {
          sessionId,
          skillId,
        },
      },
      update: {
        status: parsed.data.status,
        comment: parsed.data.status === CPWVoteStatus.RED ? parsed.data.comment?.trim() : null,
        updatedAt: new Date(),
      },
      create: {
        sessionId,
        skillId,
        status: parsed.data.status,
        comment: parsed.data.status === CPWVoteStatus.RED ? parsed.data.comment?.trim() : null,
      },
    });
  } catch (error) {
    console.error("Failed to submit vote", error);
    return { error: "Failed to submit vote. Please try again." };
  }

  revalidatePath("/cpw/vote");
  revalidatePath("/cpw/display");
  revalidatePath("/cpw/admin/proxy");

  return { success: true };
}
