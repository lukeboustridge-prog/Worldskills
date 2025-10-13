"use server";

import { randomUUID } from "node:crypto";

import { Prisma, Role } from "@prisma/client";
import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/lib/auth";
import {
  applyTemplateUpdateToDeliverables,
  ensureStandardDeliverablesForSkill,
  getDeliverableTemplates,
  recalculateDeliverableSchedule
} from "@/lib/deliverables";
import {
  applyGateTemplateUpdate,
  ensureStandardGatesForSkill,
  getGateTemplates
} from "@/lib/gates";
import { prisma } from "@/lib/prisma";
import { hasGateTemplateCatalogSupport, hasInvitationTable } from "@/lib/schema-info";
import { getAppSettings, requireAppSettings, upsertAppSettings } from "@/lib/settings";

const settingsSchema = z.object({
  competitionName: z.string().min(3),
  competitionStart: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid C1 start date"
  }),
  competitionEnd: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid C4 end date"
  }),
  keyDates: z.string().optional(),
  confirmRecalculate: z.string().optional()
});

export async function saveCompetitionSettingsAction(formData: FormData) {
  const user = await requireAdminUser();

  const existing = await getAppSettings();

  const parsed = settingsSchema.parse({
    competitionName: formData.get("competitionName"),
    competitionStart: formData.get("competitionStart"),
    competitionEnd: formData.get("competitionEnd"),
    keyDates: formData.get("keyDates"),
    confirmRecalculate: formData.get("confirmRecalculate")
  });

  const competitionStart = new Date(parsed.competitionStart);
  const competitionEnd = new Date(parsed.competitionEnd);

  if (competitionEnd <= competitionStart) {
    throw new Error("Competition end date must be after the start date.");
  }

  let keyDatesJson: Prisma.InputJsonValue = {};
  if (parsed.keyDates && parsed.keyDates.trim().length > 0) {
    try {
      const parsedJson = JSON.parse(parsed.keyDates);
      if (!isInputJsonValue(parsedJson)) {
        throw new Error();
      }
      keyDatesJson = parsedJson;
    } catch (error) {
      throw new Error("Key dates must be valid JSON.");
    }
  }

  const changingC1 = existing && existing.competitionStart.getTime() !== competitionStart.getTime();

  if (existing && changingC1 && parsed.confirmRecalculate !== "on") {
    throw new Error("Changing C1 requires confirmation to recalculate deliverable schedules.");
  }

  const updated = await upsertAppSettings({
    competitionName: parsed.competitionName,
    competitionStart,
    competitionEnd,
    keyDates: keyDatesJson
  });

  let recalculated = false;
  if (!existing || changingC1) {
    await recalculateDeliverableSchedule({ settings: updated, actorId: user.id });
    recalculated = true;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ updated: "1" });
  if (recalculated) {
    params.set("recalculated", "1");
  }
  redirect(`/settings?${params.toString()}`);
}

function isInputJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isInputJsonValue(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((item) =>
      isInputJsonValue(item)
    );
  }

  return false;
}

export async function createMissingDeliverablesAction() {
  const user = await requireAdminUser();

  const settings = await requireAppSettings();
  const skills = await prisma.skill.findMany({ select: { id: true } });
  const [templates, gateTemplates] = await Promise.all([
    getDeliverableTemplates(),
    getGateTemplates()
  ]);

  let totalCreated = 0;
  let totalGates = 0;
  for (const skill of skills) {
    const created = await ensureStandardDeliverablesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id,
      templates
    });
    totalCreated += created.length;

    const createdGates = await ensureStandardGatesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id,
      templates: gateTemplates
    });
    totalGates += createdGates.length;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ backfilled: "1", created: String(totalCreated) });
  if (totalGates > 0) {
    params.set("gatesCreated", String(totalGates));
  }
  redirect(`/settings?${params.toString()}`);
}

const templateCreateSchema = z.object({
  label: z.string().min(3, "Label must be at least 3 characters long"),
  offsetMonths: z.coerce.number().int().min(0).max(48),
  position: z.coerce.number().int().min(1).optional(),
  key: z.string().optional()
});

function normalizeTemplateKey(label: string, explicitKey?: string) {
  const source = explicitKey && explicitKey.trim().length > 0 ? explicitKey : label;
  const words = source
    .trim()
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    throw new Error("Provide a label or key to generate a template identifier.");
  }
  const [first, ...rest] = words;
  const normalized =
    first.charAt(0).toUpperCase() +
    first.slice(1).toLowerCase() +
    rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
  return normalized.replace(/[^a-zA-Z0-9]/g, "");
}

export async function createDeliverableTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const parsed = templateCreateSchema.parse({
    label: formData.get("label"),
    offsetMonths: formData.get("offsetMonths"),
    position: formData.get("position"),
    key: formData.get("key")
  });

  const templates = await getDeliverableTemplates();
  const normalizedKey = normalizeTemplateKey(parsed.label, parsed.key);

  const existingTemplate = templates.find((template) => template.key === normalizedKey);
  if (existingTemplate) {
    throw new Error("A deliverable with that key already exists.");
  }

  const maxPosition = templates.reduce((max, template) => Math.max(max, template.position), 0);
  const position = parsed.position ?? maxPosition + 1;
  const settings = await requireAppSettings();

  const template = await prisma.deliverableTemplate.create({
    data: {
      key: normalizedKey,
      label: parsed.label.trim(),
      offsetMonths: parsed.offsetMonths,
      position
    }
  });

  const skills = await prisma.skill.findMany({ select: { id: true } });
  let createdCount = 0;
  const refreshedTemplates = await getDeliverableTemplates();
  for (const skill of skills) {
    const created = await ensureStandardDeliverablesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id,
      templates: refreshedTemplates
    });
    createdCount += created.filter((deliverable) => deliverable.key === template.key).length;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ templateCreated: template.key, added: String(createdCount) });
  redirect(`/settings?${params.toString()}`);
}

const templateUpdateSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(3, "Label must be at least 3 characters"),
  offsetMonths: z.coerce.number().int().min(0).max(48),
  position: z.coerce.number().int().min(1)
});

export async function updateDeliverableTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const parsed = templateUpdateSchema.parse({
    key: formData.get("key"),
    label: formData.get("label"),
    offsetMonths: formData.get("offsetMonths"),
    position: formData.get("position")
  });

  const settings = await requireAppSettings();

  const template = await prisma.deliverableTemplate.update({
    where: { key: parsed.key },
    data: {
      label: parsed.label.trim(),
      offsetMonths: parsed.offsetMonths,
      position: parsed.position
    }
  });

  await applyTemplateUpdateToDeliverables({
    template,
    settings,
    actorId: user.id
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ templateUpdated: template.key });
  redirect(`/settings?${params.toString()}`);
}

const gateTemplateCreateSchema = z.object({
  name: z.string().min(3, "Gate name must be at least 3 characters"),
  offsetMonths: z.coerce.number().int().min(0).max(48),
  position: z.coerce.number().int().min(1).optional(),
  key: z.string().optional()
});

export async function createGateTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const parsed = gateTemplateCreateSchema.parse({
    name: formData.get("name"),
    offsetMonths: formData.get("offsetMonths"),
    position: formData.get("position"),
    key: formData.get("key")
  });

  const supportsCatalog = await hasGateTemplateCatalogSupport();
  if (!supportsCatalog) {
    throw new Error("Gate templates will be available once the database migration has completed.");
  }

  const templates = await getGateTemplates();
  const normalizedKey = normalizeTemplateKey(parsed.name, parsed.key);

  const existingTemplate = templates.find((template) => template.key === normalizedKey);
  if (existingTemplate) {
    throw new Error("A gate with that key already exists.");
  }

  const maxPosition = templates.reduce((max, template) => Math.max(max, template.position), 0);
  const position = parsed.position ?? maxPosition + 1;
  const settings = await requireAppSettings();

  const template = await prisma.gateTemplate.create({
    data: {
      key: normalizedKey,
      name: parsed.name.trim(),
      offsetMonths: parsed.offsetMonths,
      position
    }
  });

  const skills = await prisma.skill.findMany({ select: { id: true } });
  let createdCount = 0;
  const refreshedTemplates = await getGateTemplates();
  for (const skill of skills) {
    const created = await ensureStandardGatesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id,
      templates: refreshedTemplates
    });
    createdCount += created.filter((gate) => gate.templateKey === template.key).length;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ gateTemplateCreated: template.key, gatesAdded: String(createdCount) });
  redirect(`/settings?${params.toString()}`);
}

const gateTemplateUpdateSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(3, "Gate name must be at least 3 characters"),
  offsetMonths: z.coerce.number().int().min(0).max(48),
  position: z.coerce.number().int().min(1)
});

export async function updateGateTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const parsed = gateTemplateUpdateSchema.parse({
    key: formData.get("key"),
    name: formData.get("name"),
    offsetMonths: formData.get("offsetMonths"),
    position: formData.get("position")
  });

  const supportsCatalog = await hasGateTemplateCatalogSupport();
  if (!supportsCatalog) {
    throw new Error("Gate templates will be available once the database migration has completed.");
  }

  const settings = await requireAppSettings();

  const template = await prisma.gateTemplate.update({
    where: { key: parsed.key },
    data: {
      name: parsed.name.trim(),
      offsetMonths: parsed.offsetMonths,
      position: parsed.position
    }
  });

  await applyGateTemplateUpdate({
    template,
    settings,
    actorId: user.id
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ gateTemplateUpdated: template.key });
  redirect(`/settings?${params.toString()}`);
}

const userUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role),
  isAdmin: z.string().optional()
});

export async function updateUserRoleAction(formData: FormData) {
  await requireAdminUser();
  const parsed = userUpdateSchema.parse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    isAdmin: formData.get("isAdmin")
  });

  const isAdmin = parsed.isAdmin === "on";
  const role = isAdmin ? Role.SA : parsed.role;

  await prisma.user.update({
    where: { id: parsed.userId },
    data: {
      role,
      isAdmin
    }
  });

  revalidatePath("/settings");
  revalidatePath("/skills");
  revalidatePath("/dashboard");

  const params = new URLSearchParams({ userUpdated: "1" });
  redirect(`/settings?${params.toString()}`);
}

const invitationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  role: z
    .nativeEnum(Role)
    .refine((role) => role !== Role.Pending, "Select a role with active permissions."),
  isAdmin: z.string().optional()
});

export async function createInvitationAction(formData: FormData) {
  const user = await requireAdminUser();
  const parsed = invitationSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    isAdmin: formData.get("isAdmin")
  });

  const invitationsSupported = await hasInvitationTable();
  if (!invitationsSupported) {
    throw new Error("Invitations will be available once the database migration has completed.");
  }

  const normalizedEmail = parsed.email.toLowerCase();
  const isAdmin = parsed.isAdmin === "on";
  const token = randomUUID();
  const expiresAt = addDays(new Date(), 7);

  await prisma.invitation.deleteMany({
    where: {
      email: normalizedEmail,
      acceptedAt: null
    }
  });

  await prisma.invitation.create({
    data: {
      name: parsed.name.trim(),
      email: normalizedEmail,
      role: isAdmin ? Role.SA : parsed.role,
      isAdmin,
      token,
      expiresAt,
      createdBy: user.id
    }
  });

  revalidatePath("/settings");

  const params = new URLSearchParams({ inviteCreated: "1", inviteToken: token, inviteEmail: normalizedEmail });
  redirect(`/settings?${params.toString()}`);
}
