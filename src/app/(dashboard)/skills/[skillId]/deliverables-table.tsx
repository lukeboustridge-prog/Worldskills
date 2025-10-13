"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { DeliverableScheduleType, DeliverableState } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDeliverableState } from "@/lib/utils";

import {
  appendEvidenceAction,
  updateDeliverableScheduleAction,
  updateDeliverableStateAction
} from "./actions";

export interface DeliverableRow {
  id: string;
  label: string;
  cMonthLabel: string | null;
  cMonthOffset: number | null;
  dueDateISO: string;
  scheduleType: DeliverableScheduleType;
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
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);

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
      const header =
        ["Label", "State", "Due date", "ScheduleType", "C-Month", "isOverdue", "overdueByDays"].join(",");
      const rows = deliverables.map((deliverable) => {
        return [
          `"${deliverable.label.replace(/"/g, '""')}"`,
          deliverable.state,
          deliverable.dueDateISO,
          deliverable.scheduleType,
          `"${deliverable.cMonthLabel ?? ""}"`,
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
                    <p className="text-xs uppercase text-muted-foreground">
                      {deliverable.scheduleType === DeliverableScheduleType.CMonth
                        ? deliverable.cMonthLabel ?? "C-month schedule"
                        : "Calendar date"}
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">{deliverable.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Due {format(dueDate, "dd MMM yyyy")}
                      {isDueSoon ? ` · ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} remaining` : ""}
                    </p>
                    {isAdvisor ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDeliverableId((current) =>
                            current === deliverable.id ? null : deliverable.id
                          )
                        }
                        className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {editingDeliverableId === deliverable.id ? "Cancel edit" : "Edit schedule"}
                      </button>
                    ) : null}
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

                {isAdvisor && editingDeliverableId === deliverable.id ? (
                  <div className="mt-4 rounded-md border bg-muted/10 p-4">
                    <DeliverableScheduleEditor
                      deliverable={deliverable}
                      skillId={skillId}
                      onComplete={() => setEditingDeliverableId(null)}
                    />
                  </div>
                ) : null}

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

interface DeliverableScheduleEditorProps {
  deliverable: DeliverableRow;
  skillId: string;
  onComplete: () => void;
}

function toDateInputValue(value: string) {
  return value.slice(0, 10);
}

function DeliverableScheduleEditor({ deliverable, skillId, onComplete }: DeliverableScheduleEditorProps) {
  const initialSchedule =
    deliverable.scheduleType === DeliverableScheduleType.CMonth ? "cmonth" : "calendar";
  const [scheduleType, setScheduleType] = useState<"calendar" | "cmonth">(initialSchedule);
  const [dueDate, setDueDate] = useState(
    initialSchedule === "calendar" ? toDateInputValue(deliverable.dueDateISO) : ""
  );
  const [offsetMonths, setOffsetMonths] = useState(
    deliverable.cMonthOffset != null ? String(deliverable.cMonthOffset) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (scheduleType === "calendar" && !dueDate) {
      setError("Select a calendar date for the deliverable.");
      return;
    }

    if (scheduleType === "cmonth" && offsetMonths.trim().length === 0) {
      setError("Enter the number of months before C1.");
      return;
    }

    const formData = new FormData();
    formData.append("deliverableId", deliverable.id);
    formData.append("skillId", skillId);
    formData.append("scheduleType", scheduleType);

    if (scheduleType === "calendar") {
      formData.append("dueDate", dueDate);
    } else {
      formData.append("offsetMonths", offsetMonths.trim());
    }

    startTransition(async () => {
      try {
        await updateDeliverableScheduleAction(formData);
        setError(null);
        onComplete();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to update schedule");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      <div className="space-y-2">
        <Label htmlFor={`schedule-${deliverable.id}`}>Schedule type</Label>
        <select
          id={`schedule-${deliverable.id}`}
          name="scheduleType"
          value={scheduleType}
          onChange={(event) => {
            const value = event.target.value as "calendar" | "cmonth";
            setScheduleType(value);
            setError(null);
            if (value === "calendar" && !dueDate) {
              setDueDate(toDateInputValue(deliverable.dueDateISO));
            }
            if (value === "cmonth" && offsetMonths.trim().length === 0) {
              setOffsetMonths(deliverable.cMonthOffset != null ? String(deliverable.cMonthOffset) : "");
            }
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          disabled={isSaving}
        >
          <option value="cmonth">C-month offset</option>
          <option value="calendar">Calendar date</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`offset-${deliverable.id}`}>Months before C1</Label>
        <Input
          id={`offset-${deliverable.id}`}
          name="offsetMonths"
          type="number"
          min={0}
          step={1}
          value={offsetMonths}
          onChange={(event) => {
            setOffsetMonths(event.target.value);
            setError(null);
          }}
          disabled={isSaving || scheduleType === "calendar"}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`due-${deliverable.id}`}>Calendar due date</Label>
        <Input
          id={`due-${deliverable.id}`}
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(event) => {
            setDueDate(event.target.value);
            setError(null);
          }}
          disabled={isSaving || scheduleType === "cmonth"}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onComplete}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
      {error ? <p className="md:col-span-4 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
