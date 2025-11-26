import { addDays, subDays } from "date-fns";
import { DeliverableScheduleType, DeliverableState, type Message } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  classifySkillStatus,
  shapeGlobalReportData,
  type SkillRiskLevel,
  type SkillStatus
} from "@/server/reports/globalReportData";
import type { DeliverableWithStatus } from "@/lib/deliverables";

function createDeliverable(params: {
  id: string;
  skillId: string;
  dueOffsetDays: number;
  state?: DeliverableState;
  now: Date;
  isHidden?: boolean;
}): DeliverableWithStatus {
  const dueDate = addDays(params.now, params.dueOffsetDays);
  const isOverdue = params.dueOffsetDays < 0 && params.state !== DeliverableState.Validated;
  const overdueByDays = isOverdue ? Math.abs(params.dueOffsetDays) : 0;

  return {
    id: params.id,
    skillId: params.skillId,
    key: params.id,
    templateKey: null,
    label: `Deliverable ${params.id}`,
    cMonthOffset: null,
    dueDate,
    cMonthLabel: null,
    scheduleType: DeliverableScheduleType.CMonth,
    state: params.state ?? DeliverableState.NotStarted,
    updatedBy: null,
    updatedAt: params.now,
    createdAt: params.now,
    overdueNotifiedAt: null,
    isHidden: params.isHidden ?? false,
    overdueByDays,
    isOverdue
  } satisfies DeliverableWithStatus;
}

describe("classifySkillStatus", () => {
  it("flags on track when there are no overdue items and progress is healthy", () => {
    const { status, riskLevel } = classifySkillStatus({
      percentComplete: 75,
      completedCount: 3,
      overdueCount: 0,
      dueSoonCount: 0,
      totalDeliverables: 4,
      oldestOverdueDays: null,
      awaitingOldestMinutes: null
    });

    expect(status).toBe<SkillStatus>("In progress");
    expect(riskLevel).toBe<SkillRiskLevel>("On track");
  });

  it("marks attention when items are due soon and progress is low", () => {
    const { riskLevel } = classifySkillStatus({
      percentComplete: 20,
      completedCount: 1,
      overdueCount: 0,
      dueSoonCount: 2,
      totalDeliverables: 5,
      oldestOverdueDays: null,
      awaitingOldestMinutes: null
    });

    expect(riskLevel).toBe<SkillRiskLevel>("Attention");
  });

  it("elevates to at risk with significant overdue load", () => {
    const { riskLevel } = classifySkillStatus({
      percentComplete: 10,
      completedCount: 0,
      overdueCount: 4,
      dueSoonCount: 0,
      totalDeliverables: 5,
      oldestOverdueDays: 12,
      awaitingOldestMinutes: null
    });

    expect(riskLevel).toBe<SkillRiskLevel>("At risk");
  });

  it("treats long-running awaiting replies as at risk", () => {
    const { riskLevel } = classifySkillStatus({
      percentComplete: 40,
      completedCount: 2,
      overdueCount: 0,
      dueSoonCount: 0,
      totalDeliverables: 5,
      oldestOverdueDays: null,
      awaitingOldestMinutes: 60 * 24 * 45
    });

    expect(riskLevel).toBe<SkillRiskLevel>("At risk");
  });
});

describe("shapeGlobalReportData", () => {
  const now = new Date("2025-01-01T00:00:00Z");

  const sa = { id: "sa1", name: "Skill Advisor", email: "sa@example.com" };
  const scm = { id: "scm1", name: "Manager", email: "scm@example.com" };

  const skills = [
    {
      id: "skill-clean",
      name: "Clean Skill",
      sector: "Alpha",
      saId: sa.id,
      scmId: scm.id,
      sa,
      scm,
      deliverables: [
        createDeliverable({ id: "d1", skillId: "skill-clean", dueOffsetDays: 10, state: DeliverableState.Validated, now })
      ]
    },
    {
      id: "skill-overdue",
      name: "Overdue Skill",
      sector: "Beta",
      saId: sa.id,
      scmId: scm.id,
      sa,
      scm,
      deliverables: [
        createDeliverable({ id: "d2", skillId: "skill-overdue", dueOffsetDays: -5, state: DeliverableState.NotStarted, now })
      ]
    },
    {
      id: "skill-awaiting",
      name: "Awaiting Skill",
      sector: "Gamma",
      saId: sa.id,
      scmId: scm.id,
      sa,
      scm,
      deliverables: [
        createDeliverable({ id: "d3", skillId: "skill-awaiting", dueOffsetDays: 15, state: DeliverableState.NotStarted, now })
      ]
    }
  ];

  const awaitingMessage: Message = {
    id: "m1",
    skillId: "skill-awaiting",
    authorId: sa.id,
    body: "System: awaiting SCM response",
    createdAt: subDays(now, 40),
    skill: {} as never,
    author: {} as never
  };

  const repliedMessage: Message = {
    id: "m2",
    skillId: "skill-clean",
    authorId: sa.id,
    body: "SA note",
    createdAt: subDays(now, 2),
    skill: {} as never,
    author: {} as never
  };

  const scmReply: Message = {
    id: "m3",
    skillId: "skill-clean",
    authorId: scm.id,
    body: "SCM reply",
    createdAt: subDays(now, 1),
    skill: {} as never,
    author: {} as never
  };

  it("builds aggregated report data with risk ordering and appendices", () => {
    const data = shapeGlobalReportData({ skills, messages: [awaitingMessage, repliedMessage, scmReply], generatedAt: now });

    expect(data.skills[0].riskLevel).toBe("At risk");
    expect(data.skills[0].name).toBe("Awaiting Skill");
    expect(data.summary.riskCounts["At risk"]).toBe(1);
    expect(data.summary.overdueDeliverables).toBe(1);
    expect(data.awaitingConversations).toHaveLength(1);
    expect(data.overdueDeliverables[0]?.skill).toBe("Overdue Skill");
  });

  it("counts awaiting replies in summary", () => {
    const data = shapeGlobalReportData({ skills, messages: [awaitingMessage], generatedAt: now });
    expect(data.summary.awaitingConversations).toBe(1);
    expect(data.awaitingConversations[0]?.ageMinutes).toBeGreaterThan(50000);
  });
});
