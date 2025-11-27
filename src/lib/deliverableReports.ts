export type CompetitionPhase = "C-5" | "C-4" | "C-3" | "C1";

export type DeliverableReportType = "pre_competition" | "at_competition";

export type DeliverableDefinition = {
  id: string;
  label: string;
  phase?: CompetitionPhase | null;
  daysBeforeC1?: number | null;
  monthsBeforeC1?: number | null;
  sortOrder: number;
  category?: string | null;
  description?: string | null;
};

export type PreCompetitionSkillStatus = {
  skillCode: string;
  skillName: string;
  advisorName: string;
  statuses: Record<string, "yes" | "no" | "na" | null>;
};
