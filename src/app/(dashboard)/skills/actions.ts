"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { assertSA, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeOptionalId(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const skillSchema = z.object({
  name: z.string().min(2, "Skill name must be at least 2 characters"),
  saId: z.string().min(1, "SA is required"),
  scmId: z.string().min(1).nullable().optional(),
  notes: z.string().optional()
});

export async function createSkillAction(formData: FormData) {
  const user = await requireUser();
  assertSA(user.role as Role);

  const saIdEntry = formData.get("saId");

  const parsed = skillSchema.safeParse({
    name: formData.get("name"),
    saId: typeof saIdEntry === "string" && saIdEntry.length > 0 ? saIdEntry : user.id,
    scmId: normalizeOptionalId(formData.get("scmId")),
    notes: normalizeOptionalText(formData.get("notes"))
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await prisma.skill.create({
    data: {
      name: parsed.data.name,
      saId: parsed.data.saId,
      ...(parsed.data.scmId ? { scmId: parsed.data.scmId } : {}),
      notes: parsed.data.notes ?? null
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "SkillCreated",
    payload: { name: skill.name, saId: skill.saId, scmId: skill.scmId ?? null }
  });

  revalidatePath("/dashboard");
  revalidatePath("/skills");
}

const updateSkillSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(2),
  saId: z.string().min(1),
  scmId: z.string().min(1).nullable(),
  notes: z.string().optional()
});

export async function updateSkillAction(formData: FormData) {
  const user = await requireUser();
  assertSA(user.role as Role);

  const parsed = updateSkillSchema.safeParse({
    skillId: formData.get("skillId"),
    name: formData.get("name"),
    saId: formData.get("saId"),
    scmId: normalizeOptionalId(formData.get("scmId")),
    notes: normalizeOptionalText(formData.get("notes"))
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const skill = await prisma.skill.update({
    where: { id: parsed.data.skillId },
    data: {
      name: parsed.data.name,
      saId: parsed.data.saId,
      scmId: parsed.data.scmId ?? null,
      notes: parsed.data.notes ?? null
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "SkillUpdated",
    payload: {
      name: skill.name,
      saId: skill.saId,
      scmId: skill.scmId ?? null
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/skills");
}

export async function deleteSkillAction(formData: FormData) {
  const user = await requireUser();
  assertSA(user.role as Role);

  const skillId = formData.get("skillId");
  if (!skillId || typeof skillId !== "string") {
    throw new Error("Missing skill identifier");
  }

  await prisma.activityLog.deleteMany({ where: { skillId } });
  await prisma.message.deleteMany({ where: { skillId } });
  await prisma.deliverable.deleteMany({ where: { skillId } });
  await prisma.gate.deleteMany({ where: { skillId } });
  await prisma.skill.delete({ where: { id: skillId } });

  revalidatePath("/dashboard");
  revalidatePath("/skills");
}
