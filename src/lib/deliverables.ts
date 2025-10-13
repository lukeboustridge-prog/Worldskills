import { differenceInCalendarDays, isAfter, subMonths } from "date-fns";

import {
  type AppSettings,
  DeliverableState,
  type Deliverable,
  type DeliverableTemplate
} from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

export const DUE_SOON_THRESHOLD_DAYS = 30;

export interface DefaultDeliverableTemplate {
  key: string;
  label: string;
  offsetMonths: number;
  position: number;
}

export const DEFAULT_DELIVERABLE_TEMPLATES: DefaultDeliverableTemplate[] = [
  {
    key: "ITPDIdentified",
    label: "ITPD Identified",
    offsetMonths: 12,
    position: 1
  },
  {
    key: "ITPDAgreementKickoff",
    label: "ITPD Agreement and Kick-off",
    offsetMonths: 10,
    position: 2
  },
  {
    key: "WSOSAlignmentPlanning",
    label: "WSOS Alignment and Initial Planning",
    offsetMonths: 9,
    position: 3
  },
  {
    key: "TestProjectDraftV1",
    label: "Test Project Draft Version 1",
    offsetMonths: 8,
    position: 4
  },
  {
    key: "ILConfirmationCPW",
    label: "IL Confirmation at CPW",
    offsetMonths: 8,
    position: 5
  },
  {
    key: "MarkingSchemeDraftWSOS",
    label: "Marking Scheme Draft aligned to WSOS",
    offsetMonths: 7,
    position: 6
  },
  {
    key: "PrototypeFeasibilityReview",
    label: "Prototype and Feasibility Review",
    offsetMonths: 6,
    position: 7
  },
  {
    key: "ITPVQuestionnaireCompleted",
    label: "ITPV Questionnaire Completed",
    offsetMonths: 5,
    position: 8
  },
  {
    key: "FinalTPMSPackage",
    label: "Final TP and MS Package",
    offsetMonths: 4,
    position: 9
  },
  {
    key: "ValidationDocumentUploads",
    label: "Validation and Document Uploads",
    offsetMonths: 4,
    position: 10
  },
  {
    key: "SAGFinalReadyMAT",
    label: "SAG Final Ready for MAT",
    offsetMonths: 3,
    position: 11
  },
  {
    key: "PreCompetitionReadinessReview",
    label: "Pre-Competition Readiness Review",
    offsetMonths: 1,
    position: 12
  }
];

export function buildCMonthLabel(offsetMonths: number) {
  return `C-${offsetMonths} Month`;
}

export function computeDueDate(competitionStart: Date, offsetMonths: number) {
  return subMonths(competitionStart, offsetMonths);
}

export interface DeliverableWithStatus extends Deliverable {
  isOverdue: boolean;
  overdueByDays: number;
}

const FINISHED_STATES = new Set<DeliverableState>([DeliverableState.Validated]);

export function decorateDeliverable(
  deliverable: Deliverable,
  now = new Date()
): DeliverableWithStatus {
  const isFinished = FINISHED_STATES.has(deliverable.state);
  const pastDue = isAfter(now, deliverable.dueDate);
  const isOverdue = pastDue && !isFinished;
  const overdueByDays = isOverdue ? Math.max(0, differenceInCalendarDays(now, deliverable.dueDate)) : 0;

  return {
    ...deliverable,
    isOverdue,
    overdueByDays
  };
}

async function getOrderedTemplates() {
  return prisma.deliverableTemplate.findMany({
    orderBy: [{ position: "asc" }, { key: "asc" }]
  });
}

export async function ensureDeliverableTemplatesSeeded() {
  const templateCount = await prisma.deliverableTemplate.count();
  if (templateCount > 0) {
    return;
  }

  await prisma.deliverableTemplate.createMany({
    data: DEFAULT_DELIVERABLE_TEMPLATES.map((template) => ({
      key: template.key,
      label: template.label,
      offsetMonths: template.offsetMonths,
      position: template.position
    })),
    skipDuplicates: true
  });
}

export async function getDeliverableTemplates() {
  await ensureDeliverableTemplatesSeeded();
  return getOrderedTemplates();
}

export async function ensureStandardDeliverablesForSkill(params: {
  skillId: string;
  settings: AppSettings;
  actorId: string;
  templates?: DeliverableTemplate[];
}) {
  const { skillId, settings, actorId } = params;
  const templates = params.templates ?? (await getDeliverableTemplates());
  const existing = await prisma.deliverable.findMany({ where: { skillId } });
  const existingKeys = new Set(existing.map((deliverable) => deliverable.key));

  const toCreate = templates.filter((definition) => !existingKeys.has(definition.key));
  if (toCreate.length === 0) {
    return [] as Deliverable[];
  }

  const created = await prisma.$transaction(
    toCreate.map((definition) =>
      prisma.deliverable.create({
        data: {
          skillId,
          key: definition.key,
          label: definition.label,
          cMonthOffset: definition.offsetMonths,
          cMonthLabel: buildCMonthLabel(definition.offsetMonths),
          dueDate: computeDueDate(settings.competitionStart, definition.offsetMonths),
          updatedBy: actorId
        }
      })
    )
  );

  await logActivity({
    skillId,
    userId: actorId,
    action: "DeliverablesSeeded",
    payload: {
      created: created.map((item) => ({ key: item.key, label: item.label }))
    }
  });

  return created;
}

export async function recalculateDeliverableSchedule(params: {
  settings: AppSettings;
  actorId: string;
}) {
  const { settings, actorId } = params;
  await ensureDeliverableTemplatesSeeded();
  const deliverables = await prisma.deliverable.findMany({
    select: {
      id: true,
      skillId: true,
      key: true,
      label: true,
      cMonthOffset: true,
      template: true
    }
  });
  if (deliverables.length === 0) {
    return;
  }

  const now = new Date();
  const updates = deliverables.map((deliverable) =>
    prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        label: deliverable.template?.label ?? deliverable.label,
        cMonthOffset: deliverable.template?.offsetMonths ?? deliverable.cMonthOffset,
        dueDate: computeDueDate(
          settings.competitionStart,
          deliverable.template?.offsetMonths ?? deliverable.cMonthOffset
        ),
        cMonthLabel: buildCMonthLabel(deliverable.template?.offsetMonths ?? deliverable.cMonthOffset),
        updatedBy: actorId,
        overdueNotifiedAt: null
      }
    })
  );

  await prisma.$transaction(updates);

  const uniqueSkillIds = Array.from(new Set(deliverables.map((deliverable) => deliverable.skillId)));
  await prisma.activityLog.createMany({
    data: uniqueSkillIds.map((skillId) => ({
      skillId,
      userId: actorId,
      action: "DeliverableDueDatesRecalculated",
      payload: {
        recalculatedAt: now.toISOString()
      }
    }))
  });
}

export async function applyTemplateUpdateToDeliverables(params: {
  template: DeliverableTemplate;
  settings: AppSettings;
  actorId: string;
}) {
  const { template, settings, actorId } = params;

  const deliverables = await prisma.deliverable.findMany({
    where: { key: template.key },
    select: { id: true, skillId: true }
  });

  if (deliverables.length === 0) {
    return;
  }

  const dueDate = computeDueDate(settings.competitionStart, template.offsetMonths);
  await prisma.$transaction(
    deliverables.map((deliverable) =>
      prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          label: template.label,
          cMonthOffset: template.offsetMonths,
          cMonthLabel: buildCMonthLabel(template.offsetMonths),
          dueDate,
          updatedBy: actorId,
          overdueNotifiedAt: null
        }
      })
    )
  );

  const uniqueSkillIds = Array.from(new Set(deliverables.map((deliverable) => deliverable.skillId)));
  const now = new Date();
  await prisma.activityLog.createMany({
    data: uniqueSkillIds.map((skillId) => ({
      skillId,
      userId: actorId,
      action: "DeliverableTemplateUpdated",
      payload: {
        templateKey: template.key,
        templateLabel: template.label,
        updatedAt: now.toISOString()
      }
    }))
  });
}

export function classifyDeliverables(deliverables: DeliverableWithStatus[]) {
  return deliverables.reduce(
    (acc, deliverable) => {
      acc.total += 1;
      acc.stateCounts[deliverable.state] = (acc.stateCounts[deliverable.state] ?? 0) + 1;
      if (deliverable.isOverdue) {
        acc.overdue += 1;
      }
      return acc;
    },
    {
      total: 0,
      overdue: 0,
      stateCounts: {} as Record<DeliverableState, number>
    }
  );
}

export function sortSkillsByRisk<T extends { deliverables: DeliverableWithStatus[] }>(skills: T[]) {
  const now = new Date();
  return skills.sort((a, b) => {
    const overdueA = a.deliverables.filter((deliverable) => deliverable.isOverdue).length;
    const overdueB = b.deliverables.filter((deliverable) => deliverable.isOverdue).length;
    if (overdueA !== overdueB) {
      return overdueB - overdueA;
    }

    const dueSoonA = a.deliverables.filter(
      (deliverable) =>
        !deliverable.isOverdue &&
        differenceInCalendarDays(deliverable.dueDate, now) <= DUE_SOON_THRESHOLD_DAYS &&
        differenceInCalendarDays(deliverable.dueDate, now) >= 0
    ).length;
    const dueSoonB = b.deliverables.filter(
      (deliverable) =>
        !deliverable.isOverdue &&
        differenceInCalendarDays(deliverable.dueDate, now) <= DUE_SOON_THRESHOLD_DAYS &&
        differenceInCalendarDays(deliverable.dueDate, now) >= 0
    ).length;

    if (dueSoonA !== dueSoonB) {
      return dueSoonB - dueSoonA;
    }

    const nextDueA = Math.min(...a.deliverables.map((deliverable) => deliverable.dueDate.getTime()));
    const nextDueB = Math.min(...b.deliverables.map((deliverable) => deliverable.dueDate.getTime()));
    return nextDueA - nextDueB;
  });
}

export async function ensureOverdueNotifications(params: {
  skillId: string;
  deliverables: DeliverableWithStatus[];
  saId: string;
}) {
  const { skillId, deliverables, saId } = params;
  const now = new Date();

  const overdueNeedingMessage = deliverables.filter(
    (deliverable) =>
      deliverable.isOverdue &&
      (!deliverable.overdueNotifiedAt || deliverable.overdueNotifiedAt < deliverable.dueDate)
  );

  if (overdueNeedingMessage.length === 0) {
    return;
  }

  await prisma.$transaction(
    overdueNeedingMessage.flatMap((deliverable) => [
      prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          overdueNotifiedAt: now
        }
      }),
      prisma.message.create({
        data: {
          skillId,
          authorId: saId,
          body: `System: ${deliverable.label} (${deliverable.cMonthLabel}) was due on ${deliverable.dueDate.toISOString().split('T')[0]} and is overdue by ${deliverable.overdueByDays} days.`
        }
      }),
      prisma.activityLog.create({
        data: {
          skillId,
          userId: saId,
          action: "DeliverableOverdueNotification",
          payload: {
            deliverableId: deliverable.id,
            overdueByDays: deliverable.overdueByDays
          }
        }
      })
    ])
  );
}
