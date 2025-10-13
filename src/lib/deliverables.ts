import { differenceInCalendarDays, isAfter, subMonths } from "date-fns";

import {
  type AppSettings,
  DeliverableKey,
  DeliverableState,
  type Deliverable
} from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

export const DUE_SOON_THRESHOLD_DAYS = 30;

export interface StandardDeliverableDefinition {
  key: DeliverableKey;
  label: string;
  offsetMonths: number;
}

export const STANDARD_DELIVERABLES: StandardDeliverableDefinition[] = [
  {
    key: DeliverableKey.ITPDIdentified,
    label: "ITPD Identified",
    offsetMonths: 12
  },
  {
    key: DeliverableKey.ITPDAgreementKickoff,
    label: "ITPD Agreement and Kick-off",
    offsetMonths: 10
  },
  {
    key: DeliverableKey.WSOSAlignmentPlanning,
    label: "WSOS Alignment and Initial Planning",
    offsetMonths: 9
  },
  {
    key: DeliverableKey.TestProjectDraftV1,
    label: "Test Project Draft Version 1",
    offsetMonths: 8
  },
  {
    key: DeliverableKey.ILConfirmationCPW,
    label: "IL Confirmation at CPW",
    offsetMonths: 8
  },
  {
    key: DeliverableKey.MarkingSchemeDraftWSOS,
    label: "Marking Scheme Draft aligned to WSOS",
    offsetMonths: 7
  },
  {
    key: DeliverableKey.PrototypeFeasibilityReview,
    label: "Prototype and Feasibility Review",
    offsetMonths: 6
  },
  {
    key: DeliverableKey.ITPVQuestionnaireCompleted,
    label: "ITPV Questionnaire Completed",
    offsetMonths: 5
  },
  {
    key: DeliverableKey.FinalTPMSPackage,
    label: "Final TP and MS Package",
    offsetMonths: 4
  },
  {
    key: DeliverableKey.ValidationDocumentUploads,
    label: "Validation and Document Uploads",
    offsetMonths: 4
  },
  {
    key: DeliverableKey.SAGFinalReadyMAT,
    label: "SAG Final Ready for MAT",
    offsetMonths: 3
  },
  {
    key: DeliverableKey.PreCompetitionReadinessReview,
    label: "Pre-Competition Readiness Review",
    offsetMonths: 1
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

export function getStandardDefinition(key: DeliverableKey) {
  return STANDARD_DELIVERABLES.find((item) => item.key === key) ?? null;
}

export async function ensureStandardDeliverablesForSkill(params: {
  skillId: string;
  settings: AppSettings;
  actorId: string;
}) {
  const { skillId, settings, actorId } = params;
  const existing = await prisma.deliverable.findMany({ where: { skillId } });
  const existingKeys = new Set(existing.map((deliverable) => deliverable.key));

  const toCreate = STANDARD_DELIVERABLES.filter((definition) => !existingKeys.has(definition.key));
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
  const deliverables = await prisma.deliverable.findMany({ select: { id: true, skillId: true, cMonthOffset: true } });
  if (deliverables.length === 0) {
    return;
  }

  const now = new Date();
  const updates = deliverables.map((deliverable) =>
    prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        dueDate: computeDueDate(settings.competitionStart, deliverable.cMonthOffset),
        cMonthLabel: buildCMonthLabel(deliverable.cMonthOffset),
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
