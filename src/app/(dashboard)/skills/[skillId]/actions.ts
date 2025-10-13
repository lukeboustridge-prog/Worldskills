"use server";

import { DeliverableState, GateScheduleType, GateStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { assertSA, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCMonthLabel, computeDueDate } from "@/lib/deliverables";
import { requireAppSettings } from "@/lib/settings";

async function ensureSkill(skillId: string) {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
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
  assertSA(user.role as Role);

  const parsed = deliverableStateSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId"),
    state: formData.get("state")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (skill.saId !== user.id) {
    throw new Error("Only the assigned Skill Advisor can update deliverables");
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
  evidence: z.string().url()
});

export async function appendEvidenceAction(formData: FormData) {
  const user = await requireUser();

  const parsed = evidenceSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    skillId: formData.get("skillId"),
    evidence: formData.get("evidence")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  const permittedUserIds = [skill.saId, skill.scmId].filter(Boolean) as string[];

  if (!permittedUserIds.includes(user.id)) {
    throw new Error("You do not have access to update this deliverable");
  }

  await prisma.deliverable.update({
    where: { id: parsed.data.deliverableId },
    data: {
      evidenceLinks: {
        push: parsed.data.evidence
      },
      updatedBy: user.id
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "DeliverableEvidenceAdded",
    payload: {
      deliverableId: parsed.data.deliverableId,
      evidence: parsed.data.evidence
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const gateSchema = z.discriminatedUnion("scheduleType", [
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

export async function createGateAction(formData: FormData) {
  const user = await requireUser();
  assertSA(user.role as Role);

  const scheduleType = formData.get("scheduleType") ?? "calendar";

  const parsed = gateSchema.safeParse(
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
  if (skill.saId !== user.id) {
    throw new Error("Only the assigned Skill Advisor can create gates");
  }

  let dueDate: Date;
  let schedule: GateScheduleType = GateScheduleType.Calendar;
  let offset: number | null = null;
  let cMonthLabel: string | null = null;

  if (parsed.data.scheduleType === "cmonth") {
    const settings = await requireAppSettings();
    offset = parsed.data.offsetMonths;
    dueDate = computeDueDate(settings.competitionStart, offset);
    schedule = GateScheduleType.CMonth;
    cMonthLabel = buildCMonthLabel(offset);
  } else {
    dueDate = new Date(parsed.data.dueDate);
  }

  const gate = await prisma.gate.create({
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
    action: "GateCreated",
    payload: {
      gateId: gate.id,
      name: gate.name,
      scheduleType: gate.scheduleType,
      cMonthOffset: gate.cMonthOffset,
      cMonthLabel: gate.cMonthLabel
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const gateStatusSchema = z.object({
  gateId: z.string().min(1),
  skillId: z.string().min(1),
  status: z.nativeEnum(GateStatus)
});

export async function updateGateStatusAction(formData: FormData) {
  const user = await requireUser();
  assertSA(user.role as Role);

  const parsed = gateStatusSchema.safeParse({
    gateId: formData.get("gateId"),
    skillId: formData.get("skillId"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (skill.saId !== user.id) {
    throw new Error("Only the assigned Skill Advisor can update gates");
  }

  const status = parsed.data.status;
  const gate = await prisma.gate.update({
    where: { id: parsed.data.gateId },
    data: {
      status,
      completedBy: status === GateStatus.Complete ? user.id : null,
      completedAt: status === GateStatus.Complete ? new Date() : null
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "GateStatusUpdated",
    payload: {
      gateId: gate.id,
      status: gate.status
    }
  });

  revalidateSkill(parsed.data.skillId);
}

const deleteGateSchema = z.object({
  gateId: z.string().min(1),
  skillId: z.string().min(1)
});

export async function deleteGateAction(formData: FormData) {
  const user = await requireUser();
  assertSA(user.role as Role);

  const parsed = deleteGateSchema.safeParse({
    gateId: formData.get("gateId"),
    skillId: formData.get("skillId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);
  if (skill.saId !== user.id) {
    throw new Error("Only the assigned Skill Advisor can remove gates");
  }

  await prisma.gate.delete({ where: { id: parsed.data.gateId } });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "GateDeleted",
    payload: { gateId: parsed.data.gateId }
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
  const permittedUserIds = [skill.saId, skill.scmId].filter(Boolean) as string[];

  if (!permittedUserIds.includes(user.id)) {
    throw new Error("You do not have access to this conversation");
  }

  await prisma.message.create({
    data: {
      skillId: parsed.data.skillId,
      authorId: user.id,
      body: parsed.data.body
    }
  });

  await logActivity({
    skillId: parsed.data.skillId,
    userId: user.id,
    action: "MessagePosted",
    payload: { body: parsed.data.body.slice(0, 140) }
  });

  revalidateSkill(parsed.data.skillId);
}
