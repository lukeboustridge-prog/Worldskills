import {
  type AppSettings,
  type Gate,
  GateScheduleType,
  type GateTemplate
} from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { buildCMonthLabel, computeDueDate } from "@/lib/deliverables";
import { hasGateTemplateCatalogSupport } from "@/lib/schema-info";

export interface GateTemplateDefinition {
  key: string;
  name: string;
  offsetMonths: number;
  position: number;
}

export const DEFAULT_GATE_TEMPLATES: GateTemplateDefinition[] = [
  {
    key: "KickoffAlignment",
    name: "Kick-off alignment",
    offsetMonths: 10,
    position: 1
  },
  {
    key: "ValidationWorkshop",
    name: "Validation workshop",
    offsetMonths: 4,
    position: 2
  },
  {
    key: "FinalSignoff",
    name: "Final sign-off",
    offsetMonths: 1,
    position: 3
  }
];

async function getOrderedTemplates() {
  return prisma.gateTemplate.findMany({
    orderBy: [{ position: "asc" }, { key: "asc" }]
  });
}

export async function ensureGateTemplatesSeeded() {
  if (!(await hasGateTemplateCatalogSupport())) {
    return;
  }

  const templateCount = await prisma.gateTemplate.count();
  if (templateCount > 0) {
    return;
  }

  await prisma.gateTemplate.createMany({
    data: DEFAULT_GATE_TEMPLATES.map((template) => ({
      key: template.key,
      name: template.name,
      offsetMonths: template.offsetMonths,
      position: template.position
    })),
    skipDuplicates: true
  });
}

export async function getGateTemplates(): Promise<GateTemplateDefinition[]> {
  const supportsCatalog = await hasGateTemplateCatalogSupport();
  if (!supportsCatalog) {
    return DEFAULT_GATE_TEMPLATES;
  }

  await ensureGateTemplatesSeeded();
  const templates = await getOrderedTemplates();

  return templates.map((template) => ({
    key: template.key,
    name: template.name,
    offsetMonths: template.offsetMonths,
    position: template.position
  }));
}

export async function ensureStandardGatesForSkill(params: {
  skillId: string;
  settings: AppSettings;
  actorId: string;
  templates?: GateTemplateDefinition[];
}) {
  const { skillId, settings, actorId } = params;
  const templates = params.templates ?? (await getGateTemplates());
  if (templates.length === 0) {
    return [] as Gate[];
  }

  const supportsCatalog = await hasGateTemplateCatalogSupport();

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

    const created = await prisma.$transaction(
      toCreate.map((template) => {
        const dueDate = computeDueDate(settings.competitionStart, template.offsetMonths);
        return prisma.gate.create({
          data: {
            skillId,
            name: template.name,
            dueDate,
            templateKey: template.key,
            scheduleType: GateScheduleType.CMonth,
            cMonthOffset: template.offsetMonths,
            cMonthLabel: buildCMonthLabel(template.offsetMonths)
          }
        });
      })
    );

    await logActivity({
      skillId,
      userId: actorId,
      action: "GatesSeeded",
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

  const created = await prisma.$transaction(
    toCreate.map((template) =>
        prisma.gate.create({
          data: {
            skillId,
            name: template.name,
            dueDate: computeDueDate(settings.competitionStart, template.offsetMonths),
            scheduleType: GateScheduleType.CMonth,
            cMonthOffset: template.offsetMonths,
            cMonthLabel: buildCMonthLabel(template.offsetMonths)
          }
        })
      )
  );

  await logActivity({
    skillId,
    userId: actorId,
    action: "GatesSeeded",
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

export async function applyGateTemplateUpdate(params: {
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

  const dueDate = computeDueDate(settings.competitionStart, template.offsetMonths);

  await prisma.$transaction(
    gates.map((gate) =>
      prisma.gate.update({
        where: { id: gate.id },
        data: {
          name: template.name,
          dueDate
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
        action: "GateTemplateUpdated",
        payload: { templateKey: template.key }
      })
    )
  );
}
