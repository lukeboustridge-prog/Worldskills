import { differenceInCalendarDays, differenceInMinutes } from "date-fns";

import { DeliverableState, type Message, type Skill, type User } from "@prisma/client";

import {
  DUE_SOON_THRESHOLD_DAYS,
  decorateDeliverable,
  type DeliverableWithStatus
} from "@/lib/deliverables";
import { prisma } from "@/lib/prisma";
import { getUserDisplayName } from "@/lib/users";

export type SkillStatus = "Not started" | "In progress" | "Completed";
export type SkillRiskLevel = "On track" | "Attention" | "At risk";

export interface SkillReportEntry {
  id: string;
  name: string;
  sector: string;
  advisor: { id: string; name: string; email?: string | null };
  scm: { id: string; name: string; email?: string | null } | null;
  percentComplete: number;
  overdueCount: number;
  dueSoonCount: number;
  completedCount: number;
  totalDeliverables: number;
  status: SkillStatus;
  riskLevel: SkillRiskLevel;
  oldestOverdueDays: number | null;
  awaitingConversations: {
    count: number;
    oldestAgeMinutes: number | null;
  };
  issues: string;
}

export interface AdvisorPerformanceEntry {
  id: string;
  name: string;
  skillCount: number;
  totalDeliverables: number;
  percentComplete: number;
  overdue: number;
  dueSoon: number;
  validated: number;
  atRiskSkills: number;
}

export interface ScmPerformanceEntry {
  id: string;
  name: string;
  skillCount: number;
  averageResponseMinutes: number | null;
  responses: number;
  awaiting: number;
  oldestAwaitingMinutes: number | null;
}

export interface SectorProgressEntry {
  sector: string;
  skills: number;
  totalDeliverables: number;
  percentComplete: number;
  overdue: number;
  dueSoon: number;
  validated: number;
}

export interface OverdueDeliverableEntry {
  skill: string;
  deliverable: string;
  dueDate: Date;
  overdueByDays: number;
  sa: string;
  scm: string;
  sector: string;
}

export interface AwaitingConversationEntry {
  skillId: string;
  skill: string;
  sa: string;
  scm: string;
  summary: string;
  ageMinutes: number;
}

export interface GlobalReportData {
  generatedAt: Date;
  competitionLabel?: string | null;
  skills: SkillReportEntry[];
  summary: {
    totalSkills: number;
    riskCounts: Record<SkillRiskLevel, number>;
    statusCounts: Record<SkillStatus, number>;
    totalDeliverables: number;
    completedDeliverables: number;
    overdueDeliverables: number;
    dueSoonDeliverables: number;
    validatedDeliverables: number;
    awaitingConversations: number;
    oldestAwaitingMinutes: number | null;
    totalConversationThreads: number;
  };
  advisorPerformance: AdvisorPerformanceEntry[];
  scmPerformance: ScmPerformanceEntry[];
  sectorProgress: SectorProgressEntry[];
  overdueDeliverables: OverdueDeliverableEntry[];
  awaitingConversations: AwaitingConversationEntry[];
  averageResponseMinutes: number | null;
  awaitingOldestAgeMinutes: number | null;
}

export interface SkillStatusInputs {
  percentComplete: number;
  completedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  totalDeliverables: number;
  oldestOverdueDays: number | null;
  awaitingOldestMinutes: number | null;
}

export function classifySkillStatus(inputs: SkillStatusInputs) {
  const {
    percentComplete,
    completedCount,
    overdueCount,
    dueSoonCount,
    totalDeliverables,
    oldestOverdueDays,
    awaitingOldestMinutes
  } = inputs;

  let status: SkillStatus = "In progress";
  if (percentComplete === 0 && completedCount === 0) {
    status = "Not started";
  } else if (percentComplete >= 100) {
    status = "Completed";
  }

  let riskLevel: SkillRiskLevel = "On track";
  const hasDeliverables = totalDeliverables > 0;
  const awaitingOldestDays = awaitingOldestMinutes ? awaitingOldestMinutes / (60 * 24) : 0;
  const overdueAge = oldestOverdueDays ?? 0;

  const qualifiesOnTrack = overdueCount === 0 && (percentComplete >= 50 || !hasDeliverables);
  if (qualifiesOnTrack) {
    riskLevel = "On track";
  } else if (
    overdueCount >= 3 ||
    overdueAge > 30 ||
    awaitingOldestDays > 30
  ) {
    riskLevel = "At risk";
  } else if (overdueCount >= 1 || (dueSoonCount > 0 && percentComplete < 50)) {
    riskLevel = "Attention";
  }

  return { status, riskLevel };
}

interface MinimalSkill extends Pick<Skill, "id" | "name" | "sector" | "saId" | "scmId"> {
  deliverables: DeliverableWithStatus[];
  sa: Pick<User, "id" | "name" | "email">;
  scm: Pick<User, "id" | "name" | "email"> | null;
}

function getSectorName(raw: string | null) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : "Unassigned sector";
}

function formatIssues(entry: {
  riskLevel: SkillRiskLevel;
  overdueCount: number;
  oldestOverdueDays: number | null;
  awaitingCount: number;
  awaitingOldestMinutes: number | null;
}) {
  const parts: string[] = [];
  if (entry.overdueCount > 0) {
    const overdueAge = entry.oldestOverdueDays ? `${entry.oldestOverdueDays} days` : "unknown age";
    parts.push(`Overdue deliverables (${entry.overdueCount}, oldest ${overdueAge})`);
  }

  if (entry.awaitingCount > 0) {
    const days = entry.awaitingOldestMinutes ? Math.floor(entry.awaitingOldestMinutes / (60 * 24)) : 0;
    const hours = entry.awaitingOldestMinutes ? Math.floor((entry.awaitingOldestMinutes % (60 * 24)) / 60) : 0;
    const wait = entry.awaitingOldestMinutes ? `${days}d ${hours}h` : "unknown age";
    parts.push(`Awaiting SCM reply (${entry.awaitingCount}, oldest ${wait})`);
  }

  if (parts.length === 0) {
    return "None identified";
  }

  return parts.join("; ");
}

function processMessages(skills: MinimalSkill[], messages: Message[], now: Date) {
  const messagesBySkill = new Map<string, Message[]>();
  for (const message of messages) {
    const list = messagesBySkill.get(message.skillId) ?? [];
    list.push(message);
    messagesBySkill.set(message.skillId, list);
  }

  let totalResponseMs = 0;
  let totalResponses = 0;
  const awaiting: AwaitingConversationEntry[] = [];

  const responseStatsByScm = new Map<
    string,
    { id: string; name: string; responses: number; totalMs: number; awaiting: number; oldestMinutes: number | null }
  >();

  const ensureScmStat = (skill: MinimalSkill) => {
    if (!skill.scmId || !skill.scm) {
      return null;
    }
    let stat = responseStatsByScm.get(skill.scmId);
    if (!stat) {
      stat = {
        id: skill.scmId,
        name: getUserDisplayName(skill.scm),
        responses: 0,
        totalMs: 0,
        awaiting: 0,
        oldestMinutes: null
      };
      responseStatsByScm.set(skill.scmId, stat);
    }
    return stat;
  };

  for (const skill of skills) {
    const conversation = (messagesBySkill.get(skill.id) ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    let pendingSaMessage: Message | null = null;

    for (const message of conversation) {
      // Skip system-generated messages (they start with "System:")
      if (message.body.startsWith("System:")) {
        continue;
      }

      const isFromSa = message.authorId === skill.saId;
      const isFromScm = Boolean(skill.scmId && message.authorId === skill.scmId);

      if (isFromSa) {
        pendingSaMessage = message;
        continue;
      }

      if (isFromScm) {
        if (pendingSaMessage) {
          const responseMs = Math.max(0, message.createdAt.getTime() - pendingSaMessage.createdAt.getTime());
          totalResponseMs += responseMs;
          totalResponses += 1;

          const stat = ensureScmStat(skill);
          if (stat) {
            stat.responses += 1;
            stat.totalMs += responseMs;
          }
        }

        pendingSaMessage = null;
      }
    }

    if (pendingSaMessage && skill.scmId) {
      const ageMinutes = Math.max(0, differenceInMinutes(now, pendingSaMessage.createdAt));
      awaiting.push({
        skillId: skill.id,
        skill: skill.name,
        sa: getUserDisplayName(skill.sa),
        scm: skill.scm ? getUserDisplayName(skill.scm) : "Unassigned",
        summary: pendingSaMessage.body,
        ageMinutes
      });

      const stat = ensureScmStat(skill);
      if (stat) {
        stat.awaiting += 1;
        if (!stat.oldestMinutes || ageMinutes > stat.oldestMinutes) {
          stat.oldestMinutes = ageMinutes;
        }
      }

    }
  }

  const averageResponseMinutes = totalResponses > 0 ? totalResponseMs / totalResponses / (1000 * 60) : null;
  const awaitingOldestAgeMinutes = awaiting.length > 0 ? Math.max(...awaiting.map((item) => item.ageMinutes)) : null;

  const scmPerformance: ScmPerformanceEntry[] = skills
    .filter((skill) => Boolean(skill.scm))
    .reduce((acc, skill) => {
      if (!skill.scm || !skill.scmId) {
        return acc;
      }
      let entry = acc.find((item) => item.id === skill.scmId);
      if (!entry) {
        const stat = responseStatsByScm.get(skill.scmId);
        entry = {
          id: skill.scmId,
          name: getUserDisplayName(skill.scm),
          skillCount: 0,
          averageResponseMinutes: stat ? (stat.responses > 0 ? stat.totalMs / stat.responses / (1000 * 60) : null) : null,
          responses: stat?.responses ?? 0,
          awaiting: stat?.awaiting ?? 0,
          oldestAwaitingMinutes: stat?.oldestMinutes ?? null
        };
        acc.push(entry);
      }
      entry.skillCount += 1;
      return acc;
    }, [] as ScmPerformanceEntry[])
    .sort((a, b) => {
      if (a.awaiting !== b.awaiting) {
        return b.awaiting - a.awaiting;
      }
      const aOldest = a.oldestAwaitingMinutes ?? 0;
      const bOldest = b.oldestAwaitingMinutes ?? 0;
      return bOldest - aOldest;
    });

  return {
    awaiting,
    averageResponseMinutes,
    awaitingOldestAgeMinutes,
    scmPerformance,
    totalResponses
  };
}

function buildSkillEntries(
  skills: MinimalSkill[],
  awaiting: AwaitingConversationEntry[],
  now: Date
) {
  const awaitingBySkill = new Map<string, AwaitingConversationEntry>();
  awaiting.forEach((entry) => {
    awaitingBySkill.set(entry.skillId, entry);
  });

  return skills.map((skill) => {
    const visibleDeliverables = skill.deliverables.filter((deliverable) => !deliverable.isHidden);
    const overdue = visibleDeliverables.filter((deliverable) => deliverable.isOverdue);
    const dueSoon = visibleDeliverables.filter((deliverable) => {
      if (deliverable.isOverdue || deliverable.state === DeliverableState.Validated) {
        return false;
      }
      const daysUntilDue = differenceInCalendarDays(deliverable.dueDate, now);
      return daysUntilDue >= 0 && daysUntilDue <= DUE_SOON_THRESHOLD_DAYS;
    });
    const completed = visibleDeliverables.filter((deliverable) => deliverable.state === DeliverableState.Validated);

    const percentComplete = visibleDeliverables.length
      ? Math.round((completed.length / visibleDeliverables.length) * 100)
      : 0;

    const awaitingInfo = awaitingBySkill.get(skill.id);
    const oldestAwaitingMinutes = awaitingInfo ? awaitingInfo.ageMinutes : null;

    const { status, riskLevel } = classifySkillStatus({
      percentComplete,
      completedCount: completed.length,
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      totalDeliverables: visibleDeliverables.length,
      oldestOverdueDays: overdue.length > 0 ? Math.max(...overdue.map((item) => item.overdueByDays)) : null,
      awaitingOldestMinutes: oldestAwaitingMinutes
    });

    const issues = formatIssues({
      riskLevel,
      overdueCount: overdue.length,
      oldestOverdueDays: overdue.length > 0 ? Math.max(...overdue.map((item) => item.overdueByDays)) : null,
      awaitingCount: awaitingInfo ? 1 : 0,
      awaitingOldestMinutes: oldestAwaitingMinutes
    });

    return {
      id: skill.id,
      name: skill.name,
      sector: getSectorName(skill.sector),
      advisor: { id: skill.saId, name: getUserDisplayName(skill.sa), email: skill.sa.email },
      scm: skill.scm ? { id: skill.scmId!, name: getUserDisplayName(skill.scm), email: skill.scm.email } : null,
      percentComplete,
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      completedCount: completed.length,
      totalDeliverables: visibleDeliverables.length,
      status,
      riskLevel,
      oldestOverdueDays: overdue.length > 0 ? Math.max(...overdue.map((item) => item.overdueByDays)) : null,
      awaitingConversations: {
        count: awaitingInfo ? 1 : 0,
        oldestAgeMinutes: oldestAwaitingMinutes
      },
      issues
    } satisfies SkillReportEntry;
  });
}

function buildAdvisorPerformance(skills: SkillReportEntry[]) {
  const map = new Map<string, AdvisorPerformanceEntry>();

  skills.forEach((skill) => {
    const existing = map.get(skill.advisor.id) ?? {
      id: skill.advisor.id,
      name: skill.advisor.name,
      skillCount: 0,
      totalDeliverables: 0,
      percentComplete: 0,
      overdue: 0,
      dueSoon: 0,
      validated: 0,
      atRiskSkills: 0
    } satisfies AdvisorPerformanceEntry;

    existing.skillCount += 1;
    existing.totalDeliverables += skill.totalDeliverables;
    existing.overdue += skill.overdueCount;
    existing.dueSoon += skill.dueSoonCount;
    existing.validated += skill.completedCount;
    if (skill.riskLevel === "At risk") {
      existing.atRiskSkills += 1;
    }

    map.set(skill.advisor.id, existing);
  });

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      percentComplete: entry.totalDeliverables > 0
        ? Math.round((entry.validated / entry.totalDeliverables) * 100)
        : 0
    }))
    .sort((a, b) => {
      if (a.atRiskSkills !== b.atRiskSkills) {
        return b.atRiskSkills - a.atRiskSkills;
      }
      if (a.overdue !== b.overdue) {
        return b.overdue - a.overdue;
      }
      return a.name.localeCompare(b.name);
    });
}

function buildSectorProgress(skills: SkillReportEntry[]) {
  const map = new Map<string, SectorProgressEntry>();

  skills.forEach((skill) => {
    const key = skill.sector;
    const existing = map.get(key) ?? {
      sector: key,
      skills: 0,
      totalDeliverables: 0,
      percentComplete: 0,
      overdue: 0,
      dueSoon: 0,
      validated: 0
    } satisfies SectorProgressEntry;

    existing.skills += 1;
    existing.totalDeliverables += skill.totalDeliverables;
    existing.overdue += skill.overdueCount;
    existing.dueSoon += skill.dueSoonCount;
    existing.validated += skill.completedCount;

    map.set(key, existing);
  });

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      percentComplete: entry.totalDeliverables > 0
        ? Math.round((entry.validated / entry.totalDeliverables) * 100)
        : 0
    }))
    .sort((a, b) => b.overdue - a.overdue || a.sector.localeCompare(b.sector));
}

function buildOverdueDeliverables(skills: MinimalSkill[]) {
  return skills
    .flatMap((skill) =>
      skill.deliverables
        .filter((deliverable) => deliverable.isOverdue && !deliverable.isHidden)
        .map(
          (deliverable) =>
            ({
              skill: skill.name,
              deliverable: deliverable.label,
              dueDate: deliverable.dueDate,
              overdueByDays: deliverable.overdueByDays,
              sa: getUserDisplayName(skill.sa),
              scm: skill.scm ? getUserDisplayName(skill.scm) : "Unassigned",
              sector: getSectorName(skill.sector)
            } satisfies OverdueDeliverableEntry)
        )
    )
    .sort((a, b) => b.overdueByDays - a.overdueByDays);
}

export function shapeGlobalReportData(params: {
  skills: MinimalSkill[];
  messages: Message[];
  generatedAt: Date;
}) {
  const { skills, messages, generatedAt } = params;
  const now = generatedAt;

  const { awaiting, averageResponseMinutes, awaitingOldestAgeMinutes, scmPerformance } = processMessages(
    skills,
    messages,
    now
  );

  const skillEntries = buildSkillEntries(skills, awaiting, now).sort((a, b) => {
    const riskOrder: Record<SkillRiskLevel, number> = { "At risk": 0, Attention: 1, "On track": 2 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    }
    if (a.overdueCount !== b.overdueCount) {
      return b.overdueCount - a.overdueCount;
    }
    const overdueA = a.oldestOverdueDays ?? 0;
    const overdueB = b.oldestOverdueDays ?? 0;
    if (overdueA !== overdueB) {
      return overdueB - overdueA;
    }
    return a.name.localeCompare(b.name);
  });

  const advisorPerformance = buildAdvisorPerformance(skillEntries);
  const sectorProgress = buildSectorProgress(skillEntries);
  const overdueDeliverables = buildOverdueDeliverables(skills);

  const summary = skillEntries.reduce(
    (acc, skill) => {
      acc.totalDeliverables += skill.totalDeliverables;
      acc.completedDeliverables += skill.completedCount;
      acc.overdueDeliverables += skill.overdueCount;
      acc.dueSoonDeliverables += skill.dueSoonCount;
      acc.validatedDeliverables += skill.completedCount;
      acc.riskCounts[skill.riskLevel] = (acc.riskCounts[skill.riskLevel] ?? 0) + 1;
      acc.statusCounts[skill.status] = (acc.statusCounts[skill.status] ?? 0) + 1;

      acc.awaitingConversations += skill.awaitingConversations.count;
      if (skill.awaitingConversations.oldestAgeMinutes) {
        acc.oldestAwaitingMinutes = acc.oldestAwaitingMinutes
          ? Math.max(acc.oldestAwaitingMinutes, skill.awaitingConversations.oldestAgeMinutes)
          : skill.awaitingConversations.oldestAgeMinutes;
      }

      return acc;
    },
    {
      totalSkills: skillEntries.length,
      riskCounts: { "At risk": 0, Attention: 0, "On track": 0 } as Record<SkillRiskLevel, number>,
      statusCounts: { "Not started": 0, "In progress": 0, Completed: 0 } as Record<SkillStatus, number>,
      totalDeliverables: 0,
      completedDeliverables: 0,
      overdueDeliverables: 0,
      dueSoonDeliverables: 0,
      validatedDeliverables: 0,
      awaitingConversations: 0,
      oldestAwaitingMinutes: null as number | null,
      totalConversationThreads: messages.length > 0 ? new Set(messages.map((message) => message.skillId)).size : 0
    }
  );

  return {
    generatedAt,
    skills: skillEntries,
    summary,
    advisorPerformance,
    scmPerformance,
    sectorProgress,
    overdueDeliverables,
    awaitingConversations: awaiting.sort((a, b) => b.ageMinutes - a.ageMinutes),
    averageResponseMinutes,
    awaitingOldestAgeMinutes
  } satisfies GlobalReportData;
}

export async function getGlobalReportData(now = new Date()) {
  const skills = await prisma.skill.findMany({
    include: {
      deliverables: true,
      sa: true,
      scm: true
    },
    orderBy: { name: "asc" }
  });

  const decoratedSkills: MinimalSkill[] = skills.map((skill) => ({
    ...skill,
    sector: skill.sector ?? null,
    deliverables: skill.deliverables.map((deliverable) => decorateDeliverable(deliverable)),
    sa: skill.sa,
    scm: skill.scm
  }));

  const skillIds = decoratedSkills.map((skill) => skill.id);
  const messages = skillIds.length
    ? await prisma.message.findMany({ where: { skillId: { in: skillIds } }, orderBy: { createdAt: "asc" } })
    : [];

  return shapeGlobalReportData({ skills: decoratedSkills, messages, generatedAt: now });
}
