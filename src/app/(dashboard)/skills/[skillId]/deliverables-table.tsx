"use client";

import { useMemo, useState, useTransition } from "react";
import { DeliverableState } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDeliverableState } from "@/lib/utils";

import { appendEvidenceAction, updateDeliverableStateAction } from "./actions";

export interface DeliverableRow {
  id: string;
  label: string;
  cMonthLabel: string;
  dueDateISO: string;
  state: DeliverableState;
  evidenceLinks: string[];
  isOverdue: boolean;
  overdueByDays: number;
}

interface DeliverablesTableProps {
  deliverables: DeliverableRow[];
  skillId: string;
  isAdvisor: boolean;
  overdueCount: number;
  stateCounts: Record<DeliverableState, number>;
  dueSoonThresholdDays: number;
}

type FilterKey = "all" | "overdue" | "dueSoon";

export function DeliverablesTable({
  deliverables,
  skillId,
  isAdvisor,
  overdueCount,
  stateCounts,
  dueSoonThresholdDays
}: DeliverablesTableProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isExporting, startExport] = useTransition();

  const filteredDeliverables = useMemo(() => {
    const now = new Date();
    return deliverables.filter((deliverable) => {
      const dueDate = new Date(deliverable.dueDateISO);
      if (filter === "overdue") {
        return deliverable.isOverdue;
      }
      if (filter === "dueSoon") {
        const daysUntilDue = differenceInCalendarDays(dueDate, now);
        return !deliverable.isOverdue && daysUntilDue >= 0 && daysUntilDue <= dueSoonThresholdDays;
      }
      return true;
    });
  }, [deliverables, filter, dueSoonThresholdDays]);

  const dueSoonCount = useMemo(() => {
    const now = new Date();
    return deliverables.filter((deliverable) => {
      const dueDate = new Date(deliverable.dueDateISO);
      const daysUntilDue = differenceInCalendarDays(dueDate, now);
      return !deliverable.isOverdue && daysUntilDue >= 0 && daysUntilDue <= dueSoonThresholdDays;
    }).length;
  }, [deliverables, dueSoonThresholdDays]);

  const notStartedCount = stateCounts[DeliverableState.NotStarted] ?? 0;
  const inProgressCount =
    (stateCounts[DeliverableState.Draft] ?? 0) + (stateCounts[DeliverableState.InProgress] ?? 0);
  const completedCount =
    (stateCounts[DeliverableState.Finalised] ?? 0) +
    (stateCounts[DeliverableState.Uploaded] ?? 0) +
    (stateCounts[DeliverableState.Validated] ?? 0);

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All deliverables" },
    { key: "overdue", label: `Overdue (${overdueCount})` },
    { key: "dueSoon", label: `Due soon (${dueSoonCount})` }
  ];

  const handleExport = () => {
    startExport(() => {
      const header = ["Label", "State", "Due date", "C-Month", "isOverdue", "overdueByDays"].join(",");
      const rows = deliverables.map((deliverable) => {
        return [
          `"${deliverable.label.replace(/"/g, '""')}"`,
          deliverable.state,
          deliverable.dueDateISO,
          `"${deliverable.cMonthLabel}"`,
          String(deliverable.isOverdue),
          String(deliverable.overdueByDays)
        ].join(",");
      });
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `skill-${skillId}-deliverables.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase text-muted-foreground">Not started</p>
            <p className="text-2xl font-semibold text-foreground">{notStartedCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase text-muted-foreground">In progress</p>
            <p className="text-2xl font-semibold text-foreground">{inProgressCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase text-muted-foreground">Completed</p>
            <p className="text-2xl font-semibold text-foreground">{completedCount}</p>
          </div>
          <div
            className={`rounded-lg border p-4 ${
              overdueCount > 0 ? "border-destructive/60 bg-destructive/10" : "bg-muted/20"
            }`}
          >
            <p className="text-xs uppercase text-muted-foreground">Overdue</p>
            <p className={`text-2xl font-semibold ${overdueCount > 0 ? "text-destructive" : "text-foreground"}`}>
              {overdueCount}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
          className="w-full md:w-auto"
        >
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Show</span>
          <div className="flex overflow-hidden rounded-md border">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                aria-pressed={filter === option.key}
                className={`px-3 py-1.5 text-sm transition ${
                  filter === option.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredDeliverables.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deliverables match the selected filters.</p>
      ) : (
        <div className="space-y-4">
          {filteredDeliverables.map((deliverable) => {
            const dueDate = new Date(deliverable.dueDateISO);
            const daysUntilDue = differenceInCalendarDays(dueDate, new Date());
            const isDueSoon =
              !deliverable.isOverdue && daysUntilDue >= 0 && daysUntilDue <= dueSoonThresholdDays;
            const evidenceCount = deliverable.evidenceLinks.length;

            return (
              <div key={deliverable.id} className="rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">{deliverable.cMonthLabel}</p>
                    <h3 className="text-lg font-semibold text-foreground">{deliverable.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Due {format(dueDate, "dd MMM yyyy")}
                      {isDueSoon ? ` · ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} remaining` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {deliverable.isOverdue ? (
                      <Badge variant="destructive">Overdue by {deliverable.overdueByDays} days</Badge>
                    ) : isDueSoon ? (
                      <Badge variant="default">Due soon</Badge>
                    ) : (
                      <Badge variant="outline">On track</Badge>
                    )}
                    <Badge variant="outline">{evidenceCount} evidence</Badge>
                    {!isAdvisor ? (
                      <Badge variant="default">{formatDeliverableState(deliverable.state)}</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
                    {isAdvisor ? (
                      <form
                        action={updateDeliverableStateAction}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <input type="hidden" name="skillId" value={skillId} />
                        <input type="hidden" name="deliverableId" value={deliverable.id} />
                        <select
                          name="state"
                          defaultValue={deliverable.state}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-[220px]"
                        >
                          {Object.values(DeliverableState).map((state) => (
                            <option key={state} value={state}>
                              {formatDeliverableState(state)}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="secondary" size="sm">
                          Update
                        </Button>
                      </form>
                    ) : (
                      <Badge variant="default" className="w-fit">
                        {formatDeliverableState(deliverable.state)}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Evidence</p>
                    {isAdvisor ? (
                      <form
                        action={appendEvidenceAction}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
                      >
                        <input type="hidden" name="skillId" value={skillId} />
                        <input type="hidden" name="deliverableId" value={deliverable.id} />
                        <Label htmlFor={`evidence-${deliverable.id}`} className="sr-only">
                          Evidence URL
                        </Label>
                        <Input
                          id={`evidence-${deliverable.id}`}
                          type="url"
                          name="evidence"
                          placeholder="Add evidence URL"
                          className="h-10 w-full sm:w-[260px]"
                          required
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Attach
                        </Button>
                      </form>
                    ) : null}
                    {evidenceCount > 0 ? (
                      <ul className="space-y-1 text-left text-sm">
                        {deliverable.evidenceLinks.map((link, index) => (
                          <li key={index}>
                            <a href={link} target="_blank" rel="noreferrer" className="text-primary underline">
                              Evidence #{index + 1}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No evidence attached yet.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
