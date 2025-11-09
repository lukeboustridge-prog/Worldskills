"use server";

import { randomUUID } from "node:crypto";

import { DeliverableScheduleType, GateScheduleType, Prisma, Role } from "@prisma/client";
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
  const [templates, milestoneTemplates] = await Promise.all([
    getDeliverableTemplates(),
    getGateTemplates()
  ]);

  let totalCreated = 0;
  let totalMilestones = 0;
  for (const skill of skills) {
    const created = await ensureStandardDeliverablesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id,
      templates
    });
    totalCreated += created.length;

    const createdMilestones = await ensureStandardGatesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id,
      templates: milestoneTemplates
    });
    totalMilestones += createdMilestones.length;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ backfilled: "1", created: String(totalCreated) });
  if (totalMilestones > 0) {
    params.set("milestonesCreated", String(totalMilestones));
  }
  redirect(`/settings?${params.toString()}`);
}

const deliverableScheduleSchema = z.discriminatedUnion("scheduleType", [
  z.object({
    scheduleType: z.literal("calendar"),
    label: z.string().min(3, "Label must be at least 3 characters long"),
    calendarDueDate: z
      .string()
      .refine((value) => !!value && !Number.isNaN(Date.parse(value)), "Provide a valid calendar date"),
    position: z.coerce.number().int().min(1).optional(),
    key: z.string().optional()
  }),
  z.object({
    scheduleType: z.literal("cmonth"),
    label: z.string().min(3, "Label must be at least 3 characters long"),
    offsetMonths: z.coerce.number().int().min(0).max(48),
    position: z.coerce.number().int().min(1).optional(),
    key: z.string().optional()
  })
]);

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
  const scheduleType = (formData.get("scheduleType") ?? "cmonth").toString();
  const parsed = deliverableScheduleSchema.parse(
    scheduleType === "calendar"
      ? {
          scheduleType: "calendar",
          label: formData.get("label"),
          calendarDueDate: formData.get("calendarDueDate"),
          position: formData.get("position"),
          key: formData.get("key")
        }
      : {
          scheduleType: "cmonth",
          label: formData.get("label"),
          offsetMonths: formData.get("offsetMonths"),
          position: formData.get("position"),
          key: formData.get("key")
        }
  );

  const templates = await getDeliverableTemplates();
  const normalizedKey = normalizeTemplateKey(parsed.label, parsed.key);

  const existingTemplate = templates.find((template) => template.key === normalizedKey);
  if (existingTemplate) {
    throw new Error("A deliverable with that key already exists.");
  }

  const maxPosition = milestoneTemplates.reduce((max, template) => Math.max(max, template.position), 0);
  const position = parsed.position ?? maxPosition + 1;
  const settings = await requireAppSettings();

  const schedule =
    parsed.scheduleType === "calendar"
      ? DeliverableScheduleType.Calendar
      : DeliverableScheduleType.CMonth;

  const template = await prisma.deliverableTemplate.create({
    data: {
      key: normalizedKey,
      label: parsed.label.trim(),
      offsetMonths: parsed.scheduleType === "cmonth" ? parsed.offsetMonths : null,
      calendarDueDate:
        parsed.scheduleType === "calendar" ? new Date(parsed.calendarDueDate) : null,
      scheduleType: schedule,
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

const deliverableUpdateSchema = z.discriminatedUnion("scheduleType", [
  z.object({
    scheduleType: z.literal("calendar"),
    key: z.string().min(1),
    label: z.string().min(3, "Label must be at least 3 characters"),
    calendarDueDate: z
      .string()
      .refine((value) => !!value && !Number.isNaN(Date.parse(value)), "Provide a valid calendar date"),
    position: z.coerce.number().int().min(1)
  }),
  z.object({
    scheduleType: z.literal("cmonth"),
    key: z.string().min(1),
    label: z.string().min(3, "Label must be at least 3 characters"),
    offsetMonths: z.coerce.number().int().min(0).max(48),
    position: z.coerce.number().int().min(1)
  })
]);

export async function updateDeliverableTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const scheduleType = (formData.get("scheduleType") ?? "cmonth").toString();
  const parsed = deliverableUpdateSchema.parse(
    scheduleType === "calendar"
      ? {
          scheduleType: "calendar",
          key: formData.get("key"),
          label: formData.get("label"),
          calendarDueDate: formData.get("calendarDueDate"),
          position: formData.get("position")
        }
      : {
          scheduleType: "cmonth",
          key: formData.get("key"),
          label: formData.get("label"),
          offsetMonths: formData.get("offsetMonths"),
          position: formData.get("position")
        }
  );

  const settings = await requireAppSettings();

  const template = await prisma.deliverableTemplate.update({
    where: { key: parsed.key },
    data: {
      label: parsed.label.trim(),
      offsetMonths: parsed.scheduleType === "cmonth" ? parsed.offsetMonths : null,
      calendarDueDate:
        parsed.scheduleType === "calendar" ? new Date(parsed.calendarDueDate) : null,
      scheduleType:
        parsed.scheduleType === "calendar"
          ? DeliverableScheduleType.Calendar
          : DeliverableScheduleType.CMonth,
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

const deliverableDeletionSchema = z.object({
  key: z.string().min(1, "Missing deliverable key")
});

export async function deleteDeliverableTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const parsed = deliverableDeletionSchema.parse({ key: formData.get("key") });

  const template = await prisma.deliverableTemplate.findUnique({
    where: { key: parsed.key }
  });

  if (!template) {
    throw new Error("Deliverable template not found.");
  }

  const deliverables = await prisma.deliverable.findMany({
    where: { key: parsed.key },
    select: { skillId: true }
  });

  const uniqueSkillIds = Array.from(new Set(deliverables.map((entry) => entry.skillId)));
  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.deliverable.deleteMany({ where: { key: parsed.key } }),
    prisma.deliverableTemplate.delete({ where: { key: parsed.key } })
  ];

  if (uniqueSkillIds.length > 0) {
    const now = new Date();
    operations.push(
      prisma.activityLog.createMany({
        data: uniqueSkillIds.map((skillId) => ({
          skillId,
          userId: user.id,
          action: "DeliverableTemplateDeleted",
          payload: {
            templateKey: template.key,
            templateLabel: template.label,
            deletedAt: now.toISOString()
          }
        }))
      })
    );
  }

  const results = await prisma.$transaction(operations);
  const deliverableDeletionResult = results[0] as Prisma.BatchPayload;
  const removedCount = deliverableDeletionResult.count;

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({
    templateDeleted: template.key,
    removed: String(removedCount)
  });
  params.set("templateLabel", template.label);

  redirect(`/settings?${params.toString()}`);
}

const milestoneTemplateDeletionSchema = z.object({
  key: z.string().min(1, "Missing milestone key")
});

export async function deleteMilestoneTemplateAction(formData: FormData) {
  const user = await requireAdminUser();

  const supportsCatalog = await hasGateTemplateCatalogSupport();
  if (!supportsCatalog) {
    throw new Error("Milestone template catalog is not available.");
  }

  const parsed = milestoneTemplateDeletionSchema.parse({ key: formData.get("key") });

  const template = await prisma.gateTemplate.findUnique({
    where: { key: parsed.key }
  });

  if (!template) {
    throw new Error("Milestone template not found.");
  }

  const gates = await prisma.gate.findMany({
    where: { templateKey: parsed.key },
    select: { skillId: true }
  });

  const uniqueSkillIds = Array.from(new Set(gates.map((entry) => entry.skillId)));
  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.gate.deleteMany({ where: { templateKey: parsed.key } }),
    prisma.gateTemplate.delete({ where: { key: parsed.key } })
  ];

  if (uniqueSkillIds.length > 0) {
    const now = new Date();
    operations.push(
      prisma.activityLog.createMany({
        data: uniqueSkillIds.map((skillId) => ({
          skillId,
          userId: user.id,
          action: "GateTemplateDeleted",
          payload: {
            templateKey: template.key,
            templateName: template.name,
            deletedAt: now.toISOString()
          }
        }))
      })
    );
  }

  const results = await prisma.$transaction(operations);
  const milestoneDeletionResult = results[0] as Prisma.BatchPayload;
  const removedCount = milestoneDeletionResult.count;

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ milestoneTemplateDeleted: template.key });
  params.set("milestoneTemplateName", template.name);
  params.set("milestonesRemoved", String(removedCount));

  redirect(`/settings?${params.toString()}`);
}

const milestoneTemplateSchema = z.discriminatedUnion("scheduleType", [
  z.object({
    scheduleType: z.literal("calendar"),
    name: z.string().min(3, "Milestone name must be at least 3 characters"),
    calendarDueDate: z
      .string()
      .refine((value) => !!value && !Number.isNaN(Date.parse(value)), "Provide a valid calendar date"),
    position: z.coerce.number().int().min(1).optional(),
    key: z.string().optional()
  }),
  z.object({
    scheduleType: z.literal("cmonth"),
    name: z.string().min(3, "Milestone name must be at least 3 characters"),
    offsetMonths: z.coerce.number().int().min(0).max(48),
    position: z.coerce.number().int().min(1).optional(),
    key: z.string().optional()
  })
]);

export async function createMilestoneTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const scheduleType = (formData.get("scheduleType") ?? "cmonth").toString();
  const parsed = milestoneTemplateSchema.parse(
    scheduleType === "calendar"
      ? {
          scheduleType: "calendar",
          name: formData.get("name"),
          calendarDueDate: formData.get("calendarDueDate"),
          position: formData.get("position"),
          key: formData.get("key")
        }
      : {
          scheduleType: "cmonth",
          name: formData.get("name"),
          offsetMonths: formData.get("offsetMonths"),
          position: formData.get("position"),
          key: formData.get("key")
        }
  );

  const supportsCatalog = await hasGateTemplateCatalogSupport();
  if (!supportsCatalog) {
    throw new Error("Milestone templates will be available once the database migration has completed.");
  }

  const milestoneTemplates = await getGateTemplates();
  const normalizedKey = normalizeTemplateKey(parsed.name, parsed.key);

  const existingTemplate = milestoneTemplates.find((template) => template.key === normalizedKey);
  if (existingTemplate) {
    throw new Error("A milestone with that key already exists.");
  }

  const maxPosition = milestoneTemplates.reduce((max, template) => Math.max(max, template.position), 0);
  const position = parsed.position ?? maxPosition + 1;
  const settings = await requireAppSettings();

  const schedule =
    parsed.scheduleType === "calendar" ? GateScheduleType.Calendar : GateScheduleType.CMonth;

  const template = await prisma.gateTemplate.create({
    data: {
      key: normalizedKey,
      name: parsed.name.trim(),
      offsetMonths: parsed.scheduleType === "cmonth" ? parsed.offsetMonths : null,
      calendarDueDate:
        parsed.scheduleType === "calendar" ? new Date(parsed.calendarDueDate) : null,
      scheduleType: schedule,
      position
    }
  });

  const skills = await prisma.skill.findMany({ select: { id: true } });
  let createdCount = 0;
  const refreshedMilestoneTemplates = await getGateTemplates();
  for (const skill of skills) {
    const created = await ensureStandardGatesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id,
      templates: refreshedMilestoneTemplates
    });
    createdCount += created.filter((gate) => gate.templateKey === template.key).length;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ milestoneTemplateCreated: template.key, milestonesAdded: String(createdCount) });
  redirect(`/settings?${params.toString()}`);
}

const milestoneTemplateUpdateSchema = z.discriminatedUnion("scheduleType", [
  z.object({
    scheduleType: z.literal("calendar"),
    key: z.string().min(1),
    name: z.string().min(3, "Milestone name must be at least 3 characters"),
    calendarDueDate: z
      .string()
      .refine((value) => !!value && !Number.isNaN(Date.parse(value)), "Provide a valid calendar date"),
    position: z.coerce.number().int().min(1)
  }),
  z.object({
    scheduleType: z.literal("cmonth"),
    key: z.string().min(1),
    name: z.string().min(3, "Milestone name must be at least 3 characters"),
    offsetMonths: z.coerce.number().int().min(0).max(48),
    position: z.coerce.number().int().min(1)
  })
]);

export async function updateMilestoneTemplateAction(formData: FormData) {
  const user = await requireAdminUser();
  const scheduleType = (formData.get("scheduleType") ?? "cmonth").toString();
  const parsed = milestoneTemplateUpdateSchema.parse(
    scheduleType === "calendar"
      ? {
          scheduleType: "calendar",
          key: formData.get("key"),
          name: formData.get("name"),
          calendarDueDate: formData.get("calendarDueDate"),
          position: formData.get("position")
        }
      : {
          scheduleType: "cmonth",
          key: formData.get("key"),
          name: formData.get("name"),
          offsetMonths: formData.get("offsetMonths"),
          position: formData.get("position")
        }
  );

  const supportsCatalog = await hasGateTemplateCatalogSupport();
  if (!supportsCatalog) {
    throw new Error("Milestone templates will be available once the database migration has completed.");
  }

  const settings = await requireAppSettings();

  const template = await prisma.gateTemplate.update({
    where: { key: parsed.key },
    data: {
      name: parsed.name.trim(),
      offsetMonths: parsed.scheduleType === "cmonth" ? parsed.offsetMonths : null,
      calendarDueDate:
        parsed.scheduleType === "calendar" ? new Date(parsed.calendarDueDate) : null,
      scheduleType:
        parsed.scheduleType === "calendar" ? GateScheduleType.Calendar : GateScheduleType.CMonth,
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

  const params = new URLSearchParams({ milestoneTemplateUpdated: template.key });
  redirect(`/settings?${params.toString()}`);
}

const userUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role),
  isAdmin: z.string().optional()
});

export async function updateUserRoleAction(formData: FormData) {
  await requireAdminUser();

  const rawIsAdmin = formData.get("isAdmin");
  const parsedResult = userUpdateSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    isAdmin: rawIsAdmin === null ? undefined : rawIsAdmin
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Unable to update the user.";
    const params = new URLSearchParams({ userError: firstError });
    return redirect(`/settings?${params.toString()}`);
  }

  const parsed = parsedResult.data;
  const isAdmin = parsed.isAdmin === "on";
  const role = parsed.role;

  try {
    await prisma.user.update({
      where: { id: parsed.userId },
      data: {
        role,
        isAdmin
      }
    });
  } catch (error) {
    console.error("Failed to update user role", error);
    const params = new URLSearchParams({ userError: "Unable to update the user. Please try again." });
    return redirect(`/settings?${params.toString()}`);
  }

  revalidatePath("/settings");
  revalidatePath("/skills");
  revalidatePath("/dashboard");

  const params = new URLSearchParams({ userUpdated: "1" });
  return redirect(`/settings?${params.toString()}`);
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

  const rawIsAdmin = formData.get("isAdmin");
  const parsedResult = invitationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    isAdmin: rawIsAdmin === null ? undefined : rawIsAdmin
  });

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? "Please review the invitation details.";
    const params = new URLSearchParams({ inviteError: firstError });
    return redirect(`/settings?${params.toString()}`);
  }

  const invitationsSupported = await hasInvitationTable();
  if (!invitationsSupported) {
    const params = new URLSearchParams({
      inviteError: "Invitations will be available once the database migration has completed."
    });
    return redirect(`/settings?${params.toString()}`);
  }

  const parsed = parsedResult.data;
  const normalizedEmail = parsed.email.toLowerCase();
  const isAdmin = parsed.isAdmin === "on";
  const token = randomUUID();
  const expiresAt = addDays(new Date(), 7);

  try {
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
        role: parsed.role,
        isAdmin,
        token,
        expiresAt,
        createdBy: user.id
      }
    });
  } catch (error) {
    console.error("Failed to create invitation", error);
    const params = new URLSearchParams({ inviteError: "Unable to create the invitation. Please try again." });
    return redirect(`/settings?${params.toString()}`);
  }

  revalidatePath("/settings");

  const params = new URLSearchParams({ inviteCreated: "1", inviteToken: token, inviteEmail: normalizedEmail });
  return redirect(`/settings?${params.toString()}`);
}
