import { DeliverablesMatrix } from "@/components/reports/deliverables-matrix";
import { getAtCompetitionReport } from "@/lib/competitionReports";

export default async function AtCompetitionDeliverablesPage() {
  const { deliverables, skills } = await getAtCompetitionReport();

  return (
    <main className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">At competition deliverables</h1>
        <p className="text-muted-foreground">
          Reporting for at-competition deliverables will be added here once the definitions are
          confirmed.
        </p>
      </div>

      {deliverables.length === 0 ? (
        <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          At competition deliverables are coming soon. The report will appear here when the
          deliverables and statuses are defined.
        </div>
      ) : (
        <DeliverablesMatrix
          deliverables={deliverables}
          skills={skills}
          timelineHeading="Timeline relative to C1"
        />
      )}
    </main>
  );
}
