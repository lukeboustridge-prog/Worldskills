import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { buildCMonthLabel } from "@/lib/deliverables";
import type { DeliverableDefinition } from "@/lib/deliverableReports";

export type DeliverablesMatrixProps = {
  deliverables: DeliverableDefinition[];
  skills: {
    skillCode: string;
    skillName: string;
    advisorName?: string | null;
    statuses: Record<string, "yes" | "no" | "na" | null>;
  }[];
  title?: string;
  description?: string;
  timelineHeading?: string;
};

function getTimelineLabel(deliverable: DeliverableDefinition) {
  if (deliverable.phase) {
    return deliverable.phase;
  }

  if (typeof deliverable.monthsBeforeC1 === "number") {
    return buildCMonthLabel(deliverable.monthsBeforeC1);
  }

  if (typeof deliverable.daysBeforeC1 === "number") {
    return `${deliverable.daysBeforeC1} days before C1`;
  }

  return "";
}

function renderStatusBadge(status: "yes" | "no" | "na" | null | undefined) {
  if (status === null || status === undefined) {
    return <Badge className="bg-muted text-foreground">—</Badge>;
  }

  const variants: Record<"yes" | "no" | "na", { label: string; className: string }> = {
    yes: { label: "Yes", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    no: { label: "No", className: "bg-rose-100 text-rose-800 border-rose-200" },
    na: { label: "N/A", className: "bg-slate-100 text-slate-800 border-slate-200" }
  } as const;

  const { label, className } = variants[status];
  return <Badge className={className}>{label}</Badge>;
}

export function DeliverablesMatrix({
  deliverables,
  skills,
  title,
  description,
  timelineHeading = "Months before C1"
}: DeliverablesMatrixProps) {
  const sortedDeliverables = [...deliverables].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label);
  });

  return (
    <section className="space-y-4">
      {title ? <h2 className="text-lg font-semibold leading-tight">{title}</h2> : null}
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 w-64 bg-card shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                Skill
              </TableHead>
              <TableHead className="sticky left-64 z-20 w-48 bg-card shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                Skill Advisor
              </TableHead>
              {sortedDeliverables.map((deliverable) => (
                <TableHead key={deliverable.id} className="min-w-[220px] text-center align-bottom">
                  <div className="text-foreground font-semibold">{deliverable.label}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {timelineHeading}
                  </div>
                  <div className="text-xs text-muted-foreground">{getTimelineLabel(deliverable)}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map((skill) => (
              <TableRow key={skill.skillCode}>
                <TableCell className="sticky left-0 z-10 w-64 bg-card font-medium shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                  <div className="text-sm text-muted-foreground">{skill.skillCode}</div>
                  <div className="text-base text-foreground">{skill.skillName}</div>
                </TableCell>
                <TableCell className="sticky left-64 z-10 w-48 bg-card shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                  <div className="text-sm text-foreground">{skill.advisorName ?? "—"}</div>
                </TableCell>
                {sortedDeliverables.map((deliverable) => (
                  <TableCell key={deliverable.id} className="text-center">
                    {renderStatusBadge(skill.statuses[deliverable.id])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
