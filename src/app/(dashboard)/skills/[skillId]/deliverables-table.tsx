"use client";

import { useMemo, useState, useTransition } from "react";
import { DeliverableState } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDeliverableState } from "@/lib/utils";

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Not started: {stateCounts[DeliverableState.NotStarted] ?? 0}</Badge>
          <Badge variant="outline">Draft: {stateCounts[DeliverableState.Draft] ?? 0}</Badge>
          <Badge variant="outline">In progress: {stateCounts[DeliverableState.InProgress] ?? 0}</Badge>
          <Badge variant="outline">Finalised: {stateCounts[DeliverableState.Finalised] ?? 0}</Badge>
          <Badge variant="outline">Uploaded: {stateCounts[DeliverableState.Uploaded] ?? 0}</Badge>
          <Badge variant="outline">Validated: {stateCounts[DeliverableState.Validated] ?? 0}</Badge>
          <Badge variant={overdueCount > 0 ? "destructive" : "outline"}>Overdue: {overdueCount}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Filter:</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All deliverables
          </Button>
          <Button
            type="button"
            variant={filter === "overdue" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("overdue")}
          >
            Overdue
          </Button>
          <Button
            type="button"
            variant={filter === "dueSoon" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("dueSoon")}
          >
            Due soon
          </Button>
        </div>
      </div>

      {filteredDeliverables.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deliverables match the selected filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deliverable</TableHead>
              <TableHead>C-Month</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeliverables.map((deliverable) => {
              const dueDate = new Date(deliverable.dueDateISO);
              return (
                <TableRow key={deliverable.id} className={cn(deliverable.isOverdue && "bg-red-50")}
                >
                  <TableCell>
                    <div className="font-medium">{deliverable.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Evidence: {deliverable.evidenceLinks.length > 0 ? deliverable.evidenceLinks.length : "None"}
                    </div>
                  </TableCell>
                  <TableCell>{deliverable.cMonthLabel}</TableCell>
                  <TableCell>{format(dueDate, "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    {isAdvisor ? (
                      <form action={updateDeliverableStateAction} className="flex items-center gap-2 text-xs">
                        <input type="hidden" name="skillId" value={skillId} />
                        <input type="hidden" name="deliverableId" value={deliverable.id} />
                        <select
                          name="state"
                          defaultValue={deliverable.state}
                          className="h-8 w-[180px] rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {Object.values(DeliverableState).map((state) => (
                            <option key={state} value={state}>
                              {formatDeliverableState(state)}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="secondary">
                          Update
                        </Button>
                      </form>
                    ) : (
                      <Badge variant="outline">{formatDeliverableState(deliverable.state)}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {deliverable.isOverdue ? (
                      <Badge variant="destructive">Overdue by {deliverable.overdueByDays} days</Badge>
                    ) : (
                      <Badge variant="outline">On track</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-y-2 text-right text-xs">
                    <form action={appendEvidenceAction} className="flex flex-col items-end gap-1 text-right">
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
                        className="h-8 w-full min-w-[220px]"
                        required
                      />
                      <Button type="submit" variant="outline" size="sm">
                        Attach evidence
                      </Button>
                    </form>
                    {deliverable.evidenceLinks.length > 0 ? (
                      <div className="text-left">
                        <p className="text-xs font-medium">Existing evidence</p>
                        <ul className="mt-1 space-y-1 text-xs">
                          {deliverable.evidenceLinks.map((link, index) => (
                            <li key={index}>
                              <a href={link} target="_blank" rel="noreferrer" className="underline">
                                Evidence #{index + 1}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
