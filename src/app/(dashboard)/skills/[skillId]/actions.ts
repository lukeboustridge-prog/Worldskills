"use server";

import { randomUUID } from "crypto";

import {
  DeliverableScheduleType,
  DeliverableState,
  GateScheduleType as MilestoneScheduleType,
  GateStatus as MilestoneStatus,
  Role
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { prisma } from "@/lib/prisma";
import {
  buildCMonthLabel,
  computeDueDate,
  createLinkEvidenceRecord,
  EVIDENCE_TYPE_VALUES,
  isDocumentEvidence,
  normaliseEvidenceItems,
  serialiseEvidenceItems
} from "@/lib/deliverables";
import { sendSkillConversationNotification } from "@/lib/email/notifications";
import { requireAppSettings } from "@/lib/settings";
import { canManageSkill } from "@/lib/permissions";

async function ensureSkill(skillId: string) {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: {
      teamMembers: { select: { userId: true } }
    }
  });
  if (!skill) {
    throw new Error("Skill not found");
  }
  return skill;
}

function revalidateSkill(skillId: string) {
  revalidatePath(`/skills/${skillId}`);
  revalidatePath("/dashboard");
}

const deliverableStateSchema = z.object({
  deliverableId: z.string().min(1),
  skillId: z.string().min(1),
  state: z.nativeEnum(DeliverableState)
});

export async function updateDeliverableStateAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deliverableStateSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId"),
    state: formData.get("state")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have access to update this deliverable");
  }

  const isSkillAdvisor = user.id === skill.saId;
  const canValidate = isSkillAdvisor || user.isAdmin;
  if (parsed.data.state === DeliverableState.Validated && !canValidate) {
    throw new Error("Only the assigned Skill Advisor or an administrator can set a deliverable to Validated");
  }

  const updated = await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      state: parsed.data.state,
      updatedBy: user.id
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableStateChanged",
    payload: {
      deliverableId: updated.id,
      state: updated.state
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const evidenceSchema = z.object({
  deliverableId: z.string().min(1),
  skillId: z.string().min(1),
  evidence: z.string().url(),
  type: z.enum(EVIDENCE_TYPE_VALUES)
});

export async function appendEvidenceAction(formData: FormData) {
  const user = await requireUser();

  const parsed = evidenceSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId"),
    evidence: formData.get("evidence"),
    type: formData.get("type")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have access to update this deliverable");
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: parsed.data.deliverableId },
    select: { evidenceItems: true }
  });

  if (!deliverable) {
    throw new Error("Deliverable not found");
  }

  if (parsed.data.type === "Document") {
    throw new Error("Upload documents or images using the uploader.");
  }

  const evidenceItems = normaliseEvidenceItems(deliverable.evidenceItems);
  evidenceItems.push(
    createLinkEvidenceRecord({
      url: parsed.data.evidence,
      type: parsed.data.type
    })
  );

  const evidencePayload = serialiseEvidenceItems(evidenceItems);

  await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      evidenceItems: evidencePayload,
      updatedBy: user.id
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableEvidenceAdded",
    payload: {
      deliverableId: parsed.data.deliverableId,
      evidence: parsed.data.evidence,
      type: parsed.data.type
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const evidenceTypeSchema = z.object({
  deliverableId: z.string().min(1),
  skillId: z.string().min(1),
  evidenceIndex: z.coerce
    .number({ invalid_type_error: "Evidence index must be a number" })
    .int({ message: "Evidence index must be a whole number" })
    .min(0, { message: "Evidence index is out of range" }),
  type: z.enum(EVIDENCE_TYPE_VALUES)
});

export async function updateEvidenceTypeAction(formData: FormData) {
  const user = await requireUser();

  const parsed = evidenceTypeSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId"),
    evidenceIndex: formData.get("evidenceIndex"),
    type: formData.get("type")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have access to update this evidence");
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: parsed.data.deliverableId },
    select: { evidenceItems: true }
  });

  if (!deliverable) {
    throw new Error("Deliverable not found");
  }

  const evidenceItems = normaliseEvidenceItems(deliverable.evidenceItems);
  if (parsed.data.evidenceIndex >= evidenceItems.length) {
    throw new Error("Evidence entry not found");
  }

  const updatedItems = evidenceItems.map((item, index) => {
    if (index !== parsed.data.evidenceIndex) {
      return item;
    }

    if (isDocumentEvidence(item)) {
      throw new Error("Document evidence type can't be changed.");
    }

    return { ...item, type: parsed.data.type };
  });

  const updatedPayload = serialiseEvidenceItems(updatedItems);

  await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      evidenceItems: updatedPayload,
      updatedBy: user.id
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableEvidenceTypeUpdated",
    payload: {
      deliverableId: parsed.data.deliverableId,
      evidenceIndex: parsed.data.evidenceIndex,
      type: parsed.data.type
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const deliverableScheduleSchema = z.discriminatedUnion("scheduleType", [
  z.object({
    scheduleType: z.literal("calendar"),
    deliverableId: z.string().min(1),
    skillId: z.string().min(1),
    dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Invalid date"
    })
  }),
  z.object({
    scheduleType: z.literal("cmonth"),
    deliverableId: z.string().min(1),
    skillId: z.string().min(1),
    offsetMonths: z.coerce
      .number({ invalid_type_error: "Offset must be a number" })
      .int({ message: "Offset must be a whole number" })
      .min(0, { message: "Offset cannot be negative" })
  })
]);

export async function updateDeliverableScheduleAction(formData: FormData) {
  const user = await requireUser();

  const scheduleType = (formData.get("scheduleType") ?? "calendar").toString();
  const parsed = deliverableScheduleSchema.safeParse(
    scheduleType === "cmonth"
      ? {
          scheduleType: "cmonth",
          deliverableId: formData.get("deliverableId"),
          skillId: formData.get("skillId"),
          offsetMonths: formData.get("offsetMonths")
        }
      : {
          scheduleType: "calendar",
          deliverableId: formData.get("deliverableId"),
          skillId: formData.get("skillId"),
          dueDate: formData.get("dueDate")
        }
  );

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  const canManage = canManageSkill(user, {
    saId: skill.saId,
    scmId: skill.scmId,
    teamMemberIds: skill.teamMembers.map((member) => member.userId)
  });
  if (!canManage) {
    throw new Error("Only assigned team members or an administrator can update deliverable schedules");
  }

  let dueDate: Date;
  let schedule: DeliverableScheduleType = DeliverableScheduleType.Calendar;
  let offset: number | null = null;
  let cMonthLabel: string | null = null;

  if (parsed.data.scheduleType === "cmonth") {
    const settings = await requireAppSettings();
    offset = parsed.data.offsetMonths;
    dueDate = computeDueDate(settings.competitionStart, offset);
    schedule = DeliverableScheduleType.CMonth;
    cMonthLabel = buildCMonthLabel(offset);
  } else {
    dueDate = new Date(parsed.data.dueDate);
  }

  const updated = await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      scheduleType: schedule,
      dueDate,
      cMonthOffset: offset,
      cMonthLabel,
      updatedBy: user.id,
      overdueNotifiedAt: null
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableScheduleUpdated",
    payload: {
      deliverableId: updated.id,
      scheduleType: updated.scheduleType,
      cMonthOffset: updated.cMonthOffset,
      dueDate: updated.dueDate.toISOString()
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const customDeliverableSchema = z.discriminatedUnion("scheduleType", [
  z.object({
    scheduleType: z.literal("calendar"),
    skillId: z.string().min(1),
    label: z.string().min(3, "Provide a label for the deliverable"),
    dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Select a valid calendar due date"
    })
  }),
  z.object({
    scheduleType: z.literal("cmonth"),
    skillId: z.string().min(1),
    label: z.string().min(3, "Provide a label for the deliverable"),
    offsetMonths: z.coerce
      .number({ invalid_type_error: "Offset must be a number" })
      .int({ message: "Offset must be a whole number" })
      .min(0, { message: "Offset cannot be negative" })
      .max(48, { message: "Offset cannot exceed 48 months" })
  })
]);

export async function createCustomDeliverableAction(formData: FormData) {
  const user = await requireUser();

  const scheduleType = (formData.get("scheduleType") ?? "calendar").toString();
  const parsed = customDeliverableSchema.safeParse(
    scheduleType === "cmonth"
      ? {
          scheduleType: "cmonth",
          skillId: formData.get("skillId"),
          label: formData.get("label"),
          offsetMonths: formData.get("offsetMonths")
        }
      : {
          scheduleType: "calendar",
          skillId: formData.get("skillId"),
          label: formData.get("label"),
          dueDate: formData.get("dueDate")
        }
  );

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have permission to create deliverables for this skill");
  }

  const label = parsed.data.label.trim();
  if (label.length < 3) {
    throw new Error("Deliverable label must be at least 3 characters long");
  }

  let dueDate: Date;
  let schedule: DeliverableScheduleType = DeliverableScheduleType.Calendar;
  let offset: number | null = null;
  let cMonthLabel: string | null = null;

  if (parsed.data.scheduleType === "cmonth") {
    const settings = await requireAppSettings();
    offset = parsed.data.offsetMonths;
    dueDate = computeDueDate(settings.competitionStart, offset);
    schedule = DeliverableScheduleType.CMonth;
    cMonthLabel = buildCMonthLabel(offset);
  } else {
    dueDate = new Date(parsed.data.dueDate);
  }

  const key = `custom-${randomUUID()}`;

  const deliverable = await prisma.deliverable.create({
    data: {
      skillId: skill.id,
      key,
      templateKey: null,
      label,
      scheduleType: schedule,
      dueDate,
      cMonthOffset: offset,
      cMonthLabel,
      updatedBy: user.id,
      overdueNotifiedAt: null
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "DeliverableCreated",
    payload: {
      deliverableId: deliverable.id,
      label: deliverable.label,
      key: deliverable.key,
      kind: "Custom"
    }
  });

  revalidateSkill(skill.id);
}

const milestoneSchema = z.discriminatedUnion("scheduleType", [
  z.object({
    scheduleType: z.literal("calendar"),
    skillId: z.string().min(1),
    name: z.string().min(2),
    dueDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Invalid date"
    })
  }),
  z.object({
    scheduleType: z.literal("cmonth"),
    skillId: z.string().min(1),
    name: z.string().min(2),
    offsetMonths: z.coerce
      .number({ invalid_type_error: "Offset must be a number" })
      .int({ message: "Offset must be a whole number" })
      .min(0, { message: "Offset cannot be negative" })
  })
]);

export async function createMilestoneAction(formData: FormData) {
  const user = await requireUser();

  const scheduleType = formData.get("scheduleType") ?? "calendar";

  const parsed = milestoneSchema.safeParse(
    scheduleType === "cmonth"
      ? {
          scheduleType,
          skillId: formData.get("skillId"),
          name: formData.get("name"),
          offsetMonths: formData.get("offsetMonths")
        }
      : {
          scheduleType: "calendar",
          skillId: formData.get("skillId"),
          name: formData.get("name"),
          dueDate: formData.get("dueDate")
        }
  );

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have access to create milestones for this skill");
  }

  let dueDate: Date;
  let schedule: MilestoneScheduleType = MilestoneScheduleType.Calendar;
  let offset: number | null = null;
  let cMonthLabel: string | null = null;

  if (parsed.data.scheduleType === "cmonth") {
    const settings = await requireAppSettings();
    offset = parsed.data.offsetMonths;
    dueDate = computeDueDate(settings.competitionStart, offset);
    schedule = MilestoneScheduleType.CMonth;
    cMonthLabel = buildCMonthLabel(offset);
  } else {
    dueDate = new Date(parsed.data.dueDate);
  }

  const milestone = await prisma.gate.create({
    data: {
      skillId: parsed.data.skillId,
      name: parsed.data.name,
      dueDate,
      scheduleType: schedule,
      cMonthOffset: offset,
      cMonthLabel
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "MilestoneCreated",
    payload: {
      milestoneId: milestone.id,
      name: milestone.name,
      scheduleType: milestone.scheduleType,
      cMonthOffset: milestone.cMonthOffset,
      cMonthLabel: milestone.cMonthLabel
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const deliverableVisibilitySchema = z.object({
  deliverableId: z.string().min(1),
  skillId: z.string().min(1)
});

export async function hideDeliverableAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deliverableVisibilitySchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have permission to update this deliverable");
  }

  const deliverable = await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      isHidden: true,
      updatedBy: user.id,
      overdueNotifiedAt: null
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableHidden",
    payload: {
      deliverableId: deliverable.id,
      label: deliverable.label
    }
  });

  revalidateSkill(parsed.data.skillId);
}

export async function unhideDeliverableAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deliverableVisibilitySchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have permission to update this deliverable");
  }

  const deliverable = await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      isHidden: false,
      updatedBy: user.id,
      overdueNotifiedAt: null
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableRestored",
    payload: {
      deliverableId: deliverable.id,
      label: deliverable.label
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const milestoneStatusSchema = z.object({
  milestoneId: z.string().min(1),
  skillId: z.string().min(1),
  status: z.nativeEnum(MilestoneStatus)
});

export async function updateMilestoneStatusAction(formData: FormData) {
  const user = await requireUser();

  const parsed = milestoneStatusSchema.safeParse({
    milestoneId: formData.get("milestoneId"),
    skillId: formData.get("skillId"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have access to update milestones for this skill");
  }

  const status = parsed.data.status;
  const milestone = await prisma.gate.update({
    where: { id: parsed.data.milestoneId },
    data: {
      status,
      completedBy: status === MilestoneStatus.Complete ? user.id : null,
      completedAt: status === MilestoneStatus.Complete ? new Date() : null
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "MilestoneStatusUpdated",
    payload: {
      milestoneId: milestone.id,
      status: milestone.status
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const deleteMilestoneSchema = z.object({
  milestoneId: z.string().min(1),
  skillId: z.string().min(1)
});

export async function deleteMilestoneAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deleteMilestoneSchema.safeParse({
    milestoneId: formData.get("milestoneId"),
    skillId: formData.get("skillId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have access to remove milestones for this skill");
  }

  await prisma.gate.delete({ where: { id: parsed.data.milestoneId } });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "MilestoneDeleted",
    payload: { milestoneId: parsed.data.milestoneId }
  });

  revalidateSkill(parsed.data.skillId);
}

const messageSchema = z.object({
  skillId: z.string().min(1),
  body: z.string().min(2)
});

export async function createMessageAction(formData: FormData) {
  const user = await requireUser();

  const parsed = messageSchema.safeParse({
    skillId: formData.get("skillId"),
    body: formData.get("body")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  const permittedUserIds = [
    skill.saId,
    skill.scmId,
    ...skill.teamMembers.map((member) => member.userId)
  ].filter(Boolean) as string[];
  const canPost =
    user.isAdmin ||
    user.role === Role.Secretariat ||
    permittedUserIds.includes(user.id);

  if (!canPost) {
    throw new Error("You do not have access to this conversation");
  }

  await prisma.message.create({
    data: {
      skillId: parsed.data.skillId,
      authorId: user.id,
      body: parsed.data.body
    }
  });

  try {
    const skillWithParticipants = await prisma.skill.findUnique({
      where: { id: parsed.data.skillId },
      include: {
        sa: true,
        scm: true,
        teamMembers: { include: { user: true } }
      }
    });

    if (skillWithParticipants) {
      const participants = [
        skillWithParticipants.sa,
        skillWithParticipants.scm,
        ...skillWithParticipants.teamMembers.map((member) => member.user)
      ];
      const recipientEmails = participants
        .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))
        .filter((participant) => participant.id !== user.id)
        .map((participant) => participant.email)
        .filter((email): email is string => Boolean(email));

      if (recipientEmails.length > 0) {
        await sendSkillConversationNotification({
          skillId: skillWithParticipants.id,
          skillName: skillWithParticipants.name,
          messageContent: parsed.data.body,
          authorName: user.name ?? "Unknown user",
          to: recipientEmails
        });
      }
    }
  } catch (error) {
    console.error("Failed to send conversation notification", {
      skillId: parsed.data.skillId,
      authorId: user.id,
      error
    });
  }

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "MessagePosted",
    payload: { body: parsed.data.body.slice(0, 140) }
  });

  revalidateSkill(parsed.data.skillId);
}

const inviteSkillTeamSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address")
});

export async function inviteSkillTeamMemberAction(formData: FormData) {
  const user = await requireUser();

  const parsed = inviteSkillTeamSchema.safeParse({
    skillId: formData.get("skillId"),
    name: formData.get("name"),
    email: formData.get("email")
  });

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Check the invitation details.";
    const params = new URLSearchParams({ inviteError: firstError });
    redirect(`/skills/${formData.get("skillId")}?${params.toString()}`);
    return;
  }

  const skill = await prisma.skill.findUnique({
    where: { id: parsed.data.skillId },
    include: { sa: true }
  });

  if (!skill) {
    const params = new URLSearchParams({ inviteError: "Skill not found." });
    redirect(`/skills/${parsed.data.skillId}?${params.toString()}`);
    return;
  }

  if (!user.isAdmin && user.id !== skill.saId) {
    const params = new URLSearchParams({ inviteError: "Only the assigned Skill Advisor can invite team members." });
    redirect(`/skills/${skill.id}?${params.toString()}`);
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const name = parsed.data.name.trim();

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  let invitedUser = existingUser;

  if (existingUser) {
    const shouldPromote = !existingUser.isAdmin && existingUser.role === Role.Pending;
    const shouldUpdateName = !existingUser.name && name.length > 0;

    if (shouldPromote || shouldUpdateName) {
      invitedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: shouldPromote ? Role.SkillTeam : existingUser.role,
          name: shouldUpdateName ? name : existingUser.name
        }
      });
    }
  } else {
    invitedUser = await prisma.user.create({
      data: {
        email,
        name,
        role: Role.SkillTeam,
        passwordHash: null
      }
    });
  }

  if (!invitedUser) {
    const params = new URLSearchParams({ inviteError: "Unable to create the user record." });
    redirect(`/skills/${skill.id}?${params.toString()}`);
    return;
  }

  await prisma.skillMember.upsert({
    where: {
      skillId_userId: {
        skillId: skill.id,
        userId: invitedUser.id
      }
    },
    update: {},
    create: {
      skillId: skill.id,
      userId: invitedUser.id
    }
  });

  if (!invitedUser.passwordHash) {
    const token = randomUUID();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.verificationToken.deleteMany({
      where: { identifier: email }
    });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires
      }
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const setupUrl = `${baseUrl}/setup-account?token=${token}`;

    try {
      await sendWelcomeEmail({
        to: email,
        name,
        token,
        role: Role.SkillTeam,
        skillName: skill.name,
        setupUrl
      });
    } catch (error) {
      console.error("Failed to send skill team invite email", error);
      const params = new URLSearchParams({ inviteError: "Invitation saved but the email failed to send." });
      redirect(`/skills/${skill.id}?${params.toString()}`);
      return;
    }
  }

  revalidateSkill(skill.id);
  revalidatePath("/hub");
  revalidatePath("/skills");

  const params = new URLSearchParams({ invite: "sent" });
  redirect(`/skills/${skill.id}?${params.toString()}`);
}
