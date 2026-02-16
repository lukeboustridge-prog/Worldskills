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
import { sendDeliverableStatusNotification } from "@/lib/email/notifications";
import { sendPushNotificationToUsers } from "@/lib/push";
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
  state: z.nativeEnum(DeliverableState),
  comment: z.string().max(1000).optional()
});

export async function updateDeliverableStateAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deliverableStateSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId"),
    state: formData.get("state"),
    comment: formData.get("comment") || undefined
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

  // Get the deliverable to check current state
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: parsed.data.deliverableId },
    select: { state: true, label: true }
  });

  if (!deliverable) {
    throw new Error("Deliverable not found");
  }

  const previousState = deliverable.state;
  const newState = parsed.data.state;

  // Only proceed if state actually changed
  if (previousState === newState) {
    return;
  }

  const updated = await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      state: newState,
      updatedBy: user.id
    }
  });

  // Create a comment record if comment was provided
  if (parsed.data.comment?.trim()) {
    await prisma.deliverableComment.create({
      data: {
        deliverableId: parsed.data.deliverableId,
        skillId: parsed.data.skillId,
        userId: user.id,
        body: parsed.data.comment.trim(),
        previousState,
        newState
      }
    });
  }

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableStateChanged",
    payload: {
      deliverableId: updated.id,
      previousState,
      state: updated.state,
      comment: parsed.data.comment || null
    }
  });

  // Send email notification to skill team
  try {
    const skillWithTeam = await prisma.skill.findUnique({
      where: { id: parsed.data.skillId },
      include: {
        sa: true,
        scm: true,
        teamMembers: { include: { user: true } }
      }
    });

    if (skillWithTeam) {
      const participants = [
        skillWithTeam.sa,
        skillWithTeam.scm,
        ...skillWithTeam.teamMembers.map((member) => member.user)
      ];

      // Get emails of all team members except the person who made the change
      const recipientEmails = participants
        .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))
        .filter((participant) => participant.id !== user.id)
        .map((participant) => participant.email)
        .filter((email): email is string => Boolean(email));

      if (recipientEmails.length > 0) {
        const formatState = (state: DeliverableState) => {
          const labels: Record<DeliverableState, string> = {
            NotStarted: "Not Started",
            Draft: "Draft",
            InProgress: "In Progress",
            Uploaded: "Uploaded",
            Finalised: "Finalised",
            Validated: "Validated"
          };
          return labels[state] || state;
        };

        await sendDeliverableStatusNotification({
          to: recipientEmails,
          skillName: skillWithTeam.name,
          skillId: skillWithTeam.id,
          deliverableLabel: deliverable.label,
          previousStatus: formatState(previousState),
          newStatus: formatState(newState),
          changedByName: user.name ?? "A team member",
          comment: parsed.data.comment || null
        });
      }
    }
  } catch (error) {
    console.error("Failed to send deliverable status notification", {
      skillId: parsed.data.skillId,
      deliverableId: parsed.data.deliverableId,
      error
    });
  }

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

const updateCustomDeliverableLabelSchema = z.object({
  deliverableId: z.string().min(1),
  skillId: z.string().min(1),
  label: z.string().min(3, "Label must be at least 3 characters").max(200, "Label cannot exceed 200 characters")
});

export async function updateCustomDeliverableLabelAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateCustomDeliverableLabelSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId"),
    label: formData.get("label")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (!canManageSkill(user, { saId: skill.saId, scmId: skill.scmId, teamMemberIds: skill.teamMembers.map((member) => member.userId) })) {
    throw new Error("You do not have permission to update this deliverable");
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: parsed.data.deliverableId },
    select: { templateKey: true, label: true }
  });

  if (!deliverable) {
    throw new Error("Deliverable not found");
  }

  if (deliverable.templateKey !== null) {
    throw new Error("Only custom deliverables can have their label edited");
  }

  const label = parsed.data.label.trim();

  await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      label,
      updatedBy: user.id
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableLabelUpdated",
    payload: {
      deliverableId: parsed.data.deliverableId,
      previousLabel: deliverable.label,
      newLabel: label
    }
  });

  revalidateSkill(parsed.data.skillId);
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

const attachmentSchema = z.object({
  storageKey: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
});

const messageSchema = z.object({
  skillId: z.string().min(1),
  body: z.string().min(2),
  attachments: z.array(attachmentSchema).default([]),
});

export async function createMessageAction(formData: FormData) {
  const user = await requireUser();

  const attachmentsRaw = formData.get("attachments");

  const parsed = messageSchema.safeParse({
    skillId: formData.get("skillId"),
    body: formData.get("body"),
    attachments: attachmentsRaw ? JSON.parse(attachmentsRaw as string) : [],
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

  const { attachments } = parsed.data;

  await prisma.message.create({
    data: {
      skillId: parsed.data.skillId,
      authorId: user.id,
      body: parsed.data.body,
      attachments: {
        create: attachments.map((a) => ({
          storageKey: a.storageKey,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        })),
      },
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
      const recipientIds = participants
        .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))
        .filter((participant) => participant.id !== user.id)
        .map((participant) => participant.id);

      if (recipientIds.length > 0) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skill-tracker.worldskills2026.com";
        const messagePreview = parsed.data.body.length > 100
          ? parsed.data.body.slice(0, 100) + "..."
          : parsed.data.body;

        await sendPushNotificationToUsers(recipientIds, {
          title: `New message in ${skillWithParticipants.name}`,
          body: `${user.name ?? "Someone"}: ${messagePreview}`,
          url: `${baseUrl}/skills/${skillWithParticipants.id}`,
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

const skillEmailAttachmentSchema = z.object({
  storageKey: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
});

const skillEmailWithRecipientsSchema = z.object({
  skillId: z.string().min(1),
  recipientIds: z.array(z.string()).min(1, "Select at least one recipient"),
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Message is required"),
  attachments: z.array(skillEmailAttachmentSchema).default([]),
});

export async function sendSkillEmailWithRecipientsAction(formData: FormData) {
  const user = await requireUser();

  const recipientIdsRaw = formData.get("recipientIds");
  const attachmentsRaw = formData.get("attachments");

  const parsed = skillEmailWithRecipientsSchema.safeParse({
    skillId: formData.get("skillId"),
    recipientIds: recipientIdsRaw ? JSON.parse(recipientIdsRaw as string) : [],
    subject: formData.get("subject"),
    body: formData.get("body"),
    attachments: attachmentsRaw ? JSON.parse(attachmentsRaw as string) : [],
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const { skillId, recipientIds, subject, body, attachments } = parsed.data;

  const skill = await ensureSkill(skillId);
  const permittedUserIds = [
    skill.saId,
    skill.scmId,
    ...skill.teamMembers.map((member) => member.userId)
  ].filter(Boolean) as string[];

  const canSend =
    user.isAdmin ||
    user.role === Role.Secretariat ||
    permittedUserIds.includes(user.id);

  if (!canSend) {
    throw new Error("You do not have permission to send emails for this skill");
  }

  // Fetch recipients
  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, email: true, name: true, role: true }
  });

  if (recipients.length === 0) {
    throw new Error("No valid recipients selected");
  }

  // Import sendEmail dynamically to avoid circular dependencies
  const { sendEmail } = await import("@/lib/email/resend");
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getStorageEnv } = await import("@/lib/env");

  // Prepare attachments for Resend
  let resendAttachments: { content: string; filename: string }[] = [];
  if (attachments.length > 0) {
    const storage = getStorageEnv();
    const client = new S3Client({
      region: storage.region,
      endpoint: storage.endpoint,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });

    for (const attachment of attachments) {
      const command = new GetObjectCommand({
        Bucket: storage.bucket,
        Key: attachment.storageKey,
      });
      const response = await client.send(command);
      const bodyStream = response.Body;
      if (bodyStream) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of bodyStream as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        resendAttachments.push({
          content: buffer.toString("base64"),
          filename: attachment.fileName,
        });
      }
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skill-tracker.worldskills2026.com";
  const dashboardUrl = `${baseUrl}/skills/${skillId}`;
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";

  const attachmentNote =
    attachments.length > 0
      ? `<p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">This email includes ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}.</p>`
      : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <div style="background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="background-color: #2563eb; padding: 24px 24px 18px; text-align: center; border-bottom: 1px solid #1d4ed8;">
              <img src="${logoUrl}" alt="WorldSkills logo" style="height: 48px; width: auto; display: block; margin: 0 auto 16px; border-radius: 8px; background: #f8fafc; padding: 6px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">
                Worldskills Skill Tracker
              </h1>
            </div>
            <div style="padding: 28px 24px 32px;">
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #334155; line-height: 1.5;">
                <strong>${user.name ?? "A team member"}</strong> sent you a message about <strong>${skill.name}</strong>.
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Subject</p>
                <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b;">${subject}</p>
                <p style="margin: 0; font-family: Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #475569; white-space: pre-wrap; line-height: 1.6;">${body}</p>
                ${attachmentNote}
              </div>
              <div style="text-align: center;">
                <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  View Skill Workspace
                </a>
              </div>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 12px; color: #94a3b8;">
              Sent via Worldskills Skill Tracker
            </p>
          </div>
          <div style="text-align: center; margin-top: 12px;">
            <p style="font-size: 11px; color: #cbd5e1;">
              This is an automated notification. Please do not reply directly to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `${user.name ?? "A team member"} sent you a message about ${skill.name}.\n\nSubject: ${subject}\n\n${body}${attachments.length > 0 ? `\n\nThis email includes ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}.` : ""}`;

  // Send individual emails
  const emailPromises = recipients.map((recipient) =>
    sendEmail({
      to: recipient.email,
      subject: `[${skill.name}] ${subject}`,
      html,
      text,
      attachments: resendAttachments,
    }).catch((err) => {
      console.error(`Failed to send email to ${recipient.email}`, err);
      return null;
    })
  );

  await Promise.all(emailPromises);

  // Create a Message record so the email shows in the skill's Email History
  await prisma.message.create({
    data: {
      skillId,
      authorId: user.id,
      body: `**${subject}**\n\n${body}`,
      attachments: {
        create: attachments.map((a) => ({
          storageKey: a.storageKey,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        })),
      },
    },
  });

  await logActivity({
    skillId,
    userId: user.id,
    action: "SkillEmailSent",
    payload: {
      subject,
      recipientCount: recipients.length,
      attachmentCount: attachments.length
    }
  });

  revalidateSkill(skillId);

  return { success: true, recipientCount: recipients.length };
}

const updateNotesSchema = z.object({
  skillId: z.string().min(1),
  notes: z.string().max(5000, "Notes cannot exceed 5000 characters")
});

export async function updateSkillNotesAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateNotesSchema.safeParse({
    skillId: formData.get("skillId"),
    notes: formData.get("notes") ?? ""
  });

  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const skill = await ensureSkill(parsed.data.skillId);

  // Only SA, Secretariat, and Admin can edit notes
  const canEditNotes =
    user.isAdmin ||
    user.role === Role.Secretariat ||
    user.id === skill.saId;

  if (!canEditNotes) {
    return { error: "You do not have permission to edit notes for this skill" };
  }

  await prisma.skill.update({
    where: { id: parsed.data.skillId },
    data: { notes: parsed.data.notes || null }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "SkillNotesUpdated",
    payload: { notesLength: parsed.data.notes.length }
  });

  revalidateSkill(parsed.data.skillId);
  return { success: true };
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

const updateCommentSchema = z.object({
  commentId: z.string().min(1),
  skillId: z.string().min(1),
  body: z.string().min(1, "Comment cannot be empty").max(1000)
});

export async function updateDeliverableCommentAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateCommentSchema.safeParse({
    commentId: formData.get("commentId"),
    skillId: formData.get("skillId"),
    body: formData.get("body")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const comment = await prisma.deliverableComment.findUnique({
    where: { id: parsed.data.commentId },
    include: { skill: true }
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  // Only the comment author or admin can edit
  if (comment.userId !== user.id && !user.isAdmin) {
    throw new Error("You can only edit your own comments");
  }

  await prisma.deliverableComment.update({
    where: { id: parsed.data.commentId },
    data: { body: parsed.data.body.trim() }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableCommentUpdated",
    payload: {
      commentId: parsed.data.commentId,
      deliverableId: comment.deliverableId
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const deleteCommentSchema = z.object({
  commentId: z.string().min(1),
  skillId: z.string().min(1)
});

export async function deleteDeliverableCommentAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deleteCommentSchema.safeParse({
    commentId: formData.get("commentId"),
    skillId: formData.get("skillId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const comment = await prisma.deliverableComment.findUnique({
    where: { id: parsed.data.commentId }
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  // Only the comment author or admin can delete
  if (comment.userId !== user.id && !user.isAdmin) {
    throw new Error("You can only delete your own comments");
  }

  await prisma.deliverableComment.delete({
    where: { id: parsed.data.commentId }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableCommentDeleted",
    payload: {
      commentId: parsed.data.commentId,
      deliverableId: comment.deliverableId
    }
  });

  revalidateSkill(parsed.data.skillId);
}
