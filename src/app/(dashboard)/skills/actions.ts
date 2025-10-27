"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStandardDeliverablesForSkill } from "@/lib/deliverables";
import { ensureStandardGatesForSkill } from "@/lib/gates";
import { requireAppSettings } from "@/lib/settings";
import { SKILL_CATALOG } from "@/lib/skill-catalog";

function normalizeOptionalId(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const skillSchema = z.object({
  catalogId: z.string().min(1, "Skill selection is required"),
  saId: z.string().min(1, "SA is required"),
  scmId: z.string().min(1).nullable().optional(),
  notes: z.string().optional()
});

export async function createSkillAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== Role.SA && !user.isAdmin) {
    throw new Error("Only Skill Advisors or Admin can create skills");
  }

  const settings = await requireAppSettings();

  const catalogIdEntry = formData.get("skillCatalogId");
  const saIdEntry = formData.get("saId");

  const parsed = skillSchema.safeParse({
    catalogId: typeof catalogIdEntry === "string" ? catalogIdEntry : "",
    saId: typeof saIdEntry === "string" && saIdEntry.length > 0 ? saIdEntry : user.id,
    scmId: normalizeOptionalId(formData.get("scmId")),
    notes: normalizeOptionalText(formData.get("notes"))
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const catalogEntry = SKILL_CATALOG.find((entry) => entry.id === parsed.data.catalogId);
  if (!catalogEntry) {
    throw new Error("Selected skill is no longer available in the catalog");
  }

  const existingSkill = await prisma.skill.findFirst({ where: { name: catalogEntry.name } });
  if (existingSkill) {
    throw new Error("This skill has already been created");
  }

  let skill;
  try {
    skill = await prisma.skill.create({
      data: {
        name: catalogEntry.name,
        sector: catalogEntry.sector,
        saId: parsed.data.saId,
        scmId: parsed.data.scmId ?? null,
        notes: parsed.data.notes ?? null
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("This skill has already been created");
    }
    throw error;
  }

  await ensureStandardDeliverablesForSkill({
    skillId: skill.id,
    settings,
    actorId: user.id
  });

  await ensureStandardGatesForSkill({
    skillId: skill.id,
    settings,
    actorId: user.id
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "SkillCreated",
    payload: {
      name: skill.name,
      saId: skill.saId,
      scmId: skill.scmId ?? null,
      sector: skill.sector
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/skills");
}

const updateSkillSchema = z.object({
  skillId: z.string().min(1),
  saId: z.string().min(1).optional(),
  scmId: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional()
});

export async function updateSkillAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== Role.SA && !user.isAdmin) {
    throw new Error("Only Skill Advisors or Admin can update skills");
  }

  const saEntry = formData.get("saId");
  const scmEntry = formData.get("scmId");
  const notesEntry = formData.get("notes");

  const parsed = updateSkillSchema.safeParse({
    skillId: formData.get("skillId"),
    saId: typeof saEntry === "string" && saEntry.length > 0 ? saEntry : undefined,
    scmId: scmEntry === null ? undefined : normalizeOptionalId(scmEntry),
    notes:
      notesEntry === null
        ? undefined
        : typeof notesEntry === "string" && notesEntry.length > 0
          ? notesEntry
          : null
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => error.message).join(", "));
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.saId) {
    updates.saId = parsed.data.saId;
  }

  if (parsed.data.scmId !== undefined) {
    updates.scmId = parsed.data.scmId ?? null;
  }

  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const skill = await prisma.skill.update({
    where: { id: parsed.data.skillId },
    data: updates
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "SkillUpdated",
    payload: {
      saId: skill.saId,
      scmId: skill.scmId ?? null
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/skills");
}

export async function deleteSkillAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== Role.SA && !user.isAdmin) {
    throw new Error("Only Skill Advisors or Admin can delete skills");
  }

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
