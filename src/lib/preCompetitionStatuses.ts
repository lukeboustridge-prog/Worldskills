import type { PreCompetitionSkillStatus } from "@/lib/deliverableReports";

// TODO: Replace with spreadsheet import from Competition Prep Report.xlsx once available.
const preCompetitionSkillStatuses: PreCompetitionSkillStatus[] = [
  {
    skillCode: "01",
    skillName: "Industrial Mechanics",
    advisorName: "Alex Lee",
    statuses: {
      c5_test_projects: "yes",
      c5_marking_schemes: "yes",
      c5_mark_summary_forms: "no",
      c5_30_percent_change: "yes",
      c4_mat_plan_received: "no",
      c3_tablet_training_complete: "no",
      c3_mat_delivered: "na",
      c3_marking_teams_defined: "no",
      c3_marking_scheme_locked: "no",
      c3_marking_days_defined: "no"
    }
  },
  {
    skillCode: "05",
    skillName: "Mechanical Engineering CAD",
    advisorName: "Priya Desai",
    statuses: {
      c5_test_projects: "yes",
      c5_marking_schemes: "yes",
      c5_mark_summary_forms: "yes",
      c5_30_percent_change: "yes",
      c4_mat_plan_received: "yes",
      c3_tablet_training_complete: "no",
      c3_mat_delivered: "no",
      c3_marking_teams_defined: "yes",
      c3_marking_scheme_locked: "yes",
      c3_marking_days_defined: "no"
    }
  },
  {
    skillCode: "12",
    skillName: "Web Technologies",
    advisorName: "Samira Khan",
    statuses: {
      c5_test_projects: "no",
      c5_marking_schemes: "no",
      c5_mark_summary_forms: "na",
      c5_30_percent_change: "no",
      c4_mat_plan_received: "no",
      c3_tablet_training_complete: "no",
      c3_mat_delivered: "no",
      c3_marking_teams_defined: "no",
      c3_marking_scheme_locked: "no",
      c3_marking_days_defined: "no"
    }
  }
];

export async function getPreCompetitionSkillStatuses() {
  return preCompetitionSkillStatuses;
}
