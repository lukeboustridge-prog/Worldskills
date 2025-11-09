import {
  type AppSettings,
  type Gate,
  GateScheduleType as MilestoneScheduleType,
  type GateTemplate
} from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { buildCMonthLabel, computeDueDate } from "@/lib/deliverables";
import { hasMilestoneTemplateCatalogSupport } from "@/lib/schema-info";

export interface MilestoneTemplateDefinition {
  key: string;
  name: string;
  scheduleType: MilestoneScheduleType;
  offsetMonths?: number | null;
  calendarDueDate?: Date | null;
  position: number;
}

export const DEFAULT_MILESTONE_TEMPLATES: MilestoneTemplateDefinition[] = [
  {
    key: "KickoffAlignment",
    name: "Kick-off alignment",
    scheduleType: MilestoneScheduleType.CMonth,
    offsetMonths: 10,
    position: 1
  },
  {
    key: "ValidationWorkshop",
    name: "Validation workshop",
    scheduleType: MilestoneScheduleType.CMonth,
    offsetMonths: 4,
    position: 2
  },
  {
    key: "FinalSignoff",
    name: "Final sign-off",
    scheduleType: MilestoneScheduleType.CMonth,
    offsetMonths: 1,
    position: 3
  }
];

async function getOrderedTemplates() {
  return prisma.gateTemplate.findMany({
    orderBy: [{ position: "asc" }, { key: "asc" }]
  });
}

export async function ensureMilestoneTemplatesSeeded() {
  if (!(await hasMilestoneTemplateCatalogSupport())) {
    return;
  }

  const templateCount = await prisma.gateTemplate.count();
  if (templateCount > 0) {
    return;
  }

  await prisma.gateTemplate.createMany({
    data: DEFAULT_MILESTONE_TEMPLATES.map((template) => ({
      key: template.key,
      name: template.name,
      offsetMonths: template.offsetMonths ?? null,
      calendarDueDate: template.calendarDueDate ?? null,
      scheduleType: template.scheduleType,
      position: template.position
    })),
    skipDuplicates: true
  });
}

export async function getMilestoneTemplates(): Promise<MilestoneTemplateDefinition[]> {
  const supportsCatalog = await hasMilestoneTemplateCatalogSupport();
  if (!supportsCatalog) {
    return DEFAULT_MILESTONE_TEMPLATES;
  }

  await ensureMilestoneTemplatesSeeded();
  const templates = await getOrderedTemplates();

  return templates.map((template) => ({
    key: template.key,
    name: template.name,
    scheduleType: template.scheduleType,
    offsetMonths: template.offsetMonths,
    calendarDueDate: template.calendarDueDate,
    position: template.position
  }));
}

export async function ensureStandardMilestonesForSkill(params: {
  skillId: string;
  settings: AppSettings;
  actorId: string;
  templates?: MilestoneTemplateDefinition[];
}) {
  const { skillId, settings, actorId } = params;
  const templates = params.templates ?? (await getMilestoneTemplates());
  if (templates.length === 0) {
    return [] as Gate[];
  }

  const supportsCatalog = await hasMilestoneTemplateCatalogSupport();

  if (supportsCatalog) {
    const existing = await prisma.gate.findMany({
      where: { skillId },
      select: { id: true, templateKey: true }
    });
    const existingKeys = new Set(
      existing.map((gate) => gate.templateKey).filter((key): key is string => Boolean(key))
    );
    const toCreate = templates.filter((template) => !existingKeys.has(template.key));

    if (toCreate.length === 0) {
      return [] as Gate[];
    }

    const operations = toCreate
      .map((template) => {
        const usingCMonth = template.scheduleType === MilestoneScheduleType.CMonth;
        const offset = template.offsetMonths ?? null;
        const dueDate = usingCMonth
          ? offset === null
            ? null
            : computeDueDate(settings.competitionStart, offset)
          : template.calendarDueDate ?? null;

        if (!dueDate) {
          return null;
        }

        return prisma.gate.create({
          data: {
            skillId,
            name: template.name,
            dueDate,
            templateKey: template.key,
            scheduleType: template.scheduleType,
            cMonthOffset: usingCMonth ? offset : null,
            cMonthLabel: usingCMonth && offset !== null ? buildCMonthLabel(offset) : null
          }
        });
      })
      .filter((operation): operation is ReturnType<typeof prisma.gate.create> => Boolean(operation));

    if (operations.length === 0) {
      return [] as Gate[];
    }

    const created = await prisma.$transaction(operations);

    await logActivity({
      skillId,
      userId: actorId,
      action: "MilestonesSeeded",
      payload: {
        created: created.map((gate) => ({
          id: gate.id,
          name: gate.name,
          templateKey: gate.templateKey ?? null
        }))
      }
    });

    return created;
  }

  const existing = await prisma.gate.findMany({
    where: { skillId },
    select: { id: true, name: true }
  });
  const existingNames = new Set(existing.map((gate) => gate.name.toLowerCase()));
  const toCreate = templates.filter((template) => !existingNames.has(template.name.toLowerCase()));

  if (toCreate.length === 0) {
    return [] as Gate[];
  }

  const operations = toCreate
    .map((template) => {
      const usingCMonth = template.scheduleType === MilestoneScheduleType.CMonth;
      const offset = template.offsetMonths ?? null;
      const dueDate = usingCMonth
        ? offset === null
          ? null
          : computeDueDate(settings.competitionStart, offset)
        : template.calendarDueDate ?? null;

      if (!dueDate) {
        return null;
      }

      return prisma.gate.create({
        data: {
          skillId,
          name: template.name,
          dueDate,
          scheduleType: template.scheduleType,
          cMonthOffset: usingCMonth ? offset : null,
          cMonthLabel: usingCMonth && offset !== null ? buildCMonthLabel(offset) : null
        }
      });
    })
    .filter((operation): operation is ReturnType<typeof prisma.gate.create> => Boolean(operation));

  if (operations.length === 0) {
    return [] as Gate[];
  }

  const created = await prisma.$transaction(operations);

  await logActivity({
    skillId,
    userId: actorId,
    action: "MilestonesSeeded",
    payload: {
      created: created.map((gate, index) => ({
        id: gate.id,
        name: gate.name,
        templateKey: toCreate[index]?.key ?? null
      }))
    }
  });

  return created;
}

export async function applyMilestoneTemplateUpdate(params: {
  template: GateTemplate;
  settings: AppSettings;
  actorId: string;
}) {
  const { template, settings, actorId } = params;

  const gates = await prisma.gate.findMany({
    where: { templateKey: template.key }
  });

  if (gates.length === 0) {
    return;
  }

  const usingCMonth = template.scheduleType === MilestoneScheduleType.CMonth;
  const offset = template.offsetMonths ?? null;
  const dueDate = usingCMonth
    ? offset === null
      ? null
      : computeDueDate(settings.competitionStart, offset)
    : template.calendarDueDate ?? null;

  if (!dueDate) {
    return;
  }

  await prisma.$transaction(
    gates.map((gate) =>
      prisma.gate.update({
        where: { id: gate.id },
        data: {
          name: template.name,
          dueDate,
          scheduleType: template.scheduleType,
          cMonthOffset: usingCMonth ? offset : null,
          cMonthLabel: usingCMonth && offset !== null ? buildCMonthLabel(offset) : null
        }
      })
    )
  );

  const uniqueSkillIds = Array.from(new Set(gates.map((gate) => gate.skillId)));
  await Promise.all(
    uniqueSkillIds.map((skillId) =>
      logActivity({
        skillId,
        userId: actorId,
        action: "MilestoneTemplateUpdated",
        payload: { templateKey: template.key }
      })
    )
  );
}
