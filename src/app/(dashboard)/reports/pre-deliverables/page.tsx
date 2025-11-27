import { DeliverablesMatrix } from "@/components/reports/deliverables-matrix";
import { preCompetitionDeliverables } from "@/lib/preCompetitionDeliverables";
import { getPreCompetitionSkillStatuses } from "@/lib/preCompetitionStatuses";

export default async function PreCompetitionDeliverablesPage() {
  const skills = await getPreCompetitionSkillStatuses();

  return (
    <main className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Pre competition deliverables</h1>
        <p className="text-muted-foreground">
          Status of key C minus 5 to C minus 3 deliverables for each skill, relative to competition
          start (C1).
        </p>
      </div>

      <DeliverablesMatrix
        deliverables={preCompetitionDeliverables}
        skills={skills}
        timelineHeading="Timeline relative to C1"
      />
    </main>
  );
}
