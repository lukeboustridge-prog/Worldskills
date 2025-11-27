import { atCompetitionDeliverables } from "@/lib/atCompetitionDeliverables";
import { preCompetitionDeliverables } from "@/lib/preCompetitionDeliverables";
import { getPreCompetitionSkillStatuses } from "@/lib/preCompetitionStatuses";

export async function getPreCompetitionReport() {
  const skills = await getPreCompetitionSkillStatuses();
  const deliverables = preCompetitionDeliverables;

  return { deliverables, skills };
}

export async function getAtCompetitionReport() {
  // TODO: define at competition deliverables and statuses
  return { deliverables: atCompetitionDeliverables, skills: [] };
}
