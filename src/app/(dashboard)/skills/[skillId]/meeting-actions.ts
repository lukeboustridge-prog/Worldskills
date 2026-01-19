"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { sendMeetingInvitation } from "@/lib/email/meeting-invitation";
import { prisma } from "@/lib/prisma";

async function ensureSkill(skillId: string) {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: { sa: true, scm: true }
  });
  if (!skill) {
    throw new Error("Skill not found");
  }
  return skill;
}

function revalidateSkill(skillId: string) {
  revalidatePath(`/skills/${skillId}`);
}

function canScheduleMeeting(
  user: { id: string; role: Role; isAdmin: boolean },
  skill: { saId: string; scmId: string | null }
): boolean {
  if (user.isAdmin) return true;
  if (user.role === Role.SA && user.id === skill.saId) return true;
  if (user.role === Role.SCM && user.id === skill.scmId) return true;
  return false;
}

const scheduleMeetingSchema = z.object({
  skillId: z.string().min(1),
  title: z.string().min(2, "Title must be at least 2 characters"),
  startTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid start time"
  }),
  endTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid end time"
  }),
  meetingLink: z.string().url().optional().or(z.literal(""))
});

export async function scheduleMeetingAction(formData: FormData) {
  const user = await requireUser();

  const parsed = scheduleMeetingSchema.safeParse({
    skillId: formData.get("skillId"),
    title: formData.get("title"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    meetingLink: formData.get("meetingLink") || ""
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to schedule meetings for this skill");
  }

  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(parsed.data.endTime);

  if (endTime <= startTime) {
    throw new Error("End time must be after start time");
  }

  const meeting = await prisma.meeting.create({
    data: {
      skillId: skill.id,
      title: parsed.data.title,
      startTime,
      endTime,
      meetingLink: parsed.data.meetingLink || null
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingScheduled",
    payload: {
      meetingId: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime.toISOString(),
      endTime: meeting.endTime.toISOString()
    }
  });

  // Send email invitations to SA and SCM
  try {
    const recipientEmails: string[] = [];

    if (skill.sa?.email) {
      recipientEmails.push(skill.sa.email);
    }
    if (skill.scm?.email) {
      recipientEmails.push(skill.scm.email);
    }

    if (recipientEmails.length > 0) {
      await sendMeetingInvitation({
        to: recipientEmails,
        meeting: {
          title: meeting.title,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          meetingLink: meeting.meetingLink,
          skillName: skill.name
        }
      });
    }
  } catch (error) {
    console.error("Failed to send meeting invitation", {
      meetingId: meeting.id,
      skillId: skill.id,
      error
    });
  }

  revalidateSkill(skill.id);

  return { success: true, meetingId: meeting.id };
}

const updateMeetingMinutesSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1),
  minutes: z.string().optional(),
  actionPoints: z.string().optional()
});

export async function updateMeetingMinutesAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateMeetingMinutesSchema.safeParse({
    meetingId: formData.get("meetingId"),
    skillId: formData.get("skillId"),
    minutes: formData.get("minutes") || "",
    actionPoints: formData.get("actionPoints") || ""
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to update meeting minutes for this skill");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  await prisma.meeting.update({
    where: { id: parsed.data.meetingId },
    data: {
      minutes: parsed.data.minutes || null,
      actionPoints: parsed.data.actionPoints || null
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingMinutesUpdated",
    payload: {
      meetingId: meeting.id,
      title: meeting.title
    }
  });

  revalidateSkill(skill.id);

  return { success: true };
}

const deleteMeetingSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1)
});

export async function deleteMeetingAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deleteMeetingSchema.safeParse({
    meetingId: formData.get("meetingId"),
    skillId: formData.get("skillId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to delete meetings for this skill");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  await prisma.meeting.delete({
    where: { id: parsed.data.meetingId }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingDeleted",
    payload: {
      meetingId: meeting.id,
      title: meeting.title
    }
  });

  revalidateSkill(skill.id);

  return { success: true };
}
