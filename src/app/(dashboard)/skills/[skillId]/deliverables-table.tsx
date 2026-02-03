"use client";

import { FormEvent, useMemo, useState, useTransition, useCallback } from "react";
import { DeliverableScheduleType, DeliverableState } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { MessageSquare, Pencil, Trash2, X, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus } from "lucide-react";
import {
  EVIDENCE_TYPE_OPTIONS,
  type DeliverableEvidenceDocument,
  type DeliverableEvidenceItem,
  type EvidenceType,
  isDocumentEvidence
} from "@/lib/deliverables";
import { formatDeliverableState } from "@/lib/utils";

import {
  appendEvidenceAction,
  createCustomDeliverableAction,
  hideDeliverableAction,
  unhideDeliverableAction,
  updateEvidenceTypeAction,
  updateDeliverableScheduleAction,
  updateDeliverableStateAction,
  updateDeliverableCommentAction,
  deleteDeliverableCommentAction
} from "./actions";
import { DocumentEvidenceManager } from "./document-evidence-manager";

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  Document: "Document or image upload",
  Other: "Other reference"
};

export interface DeliverableComment {
  id: string;
  body: string;
  previousState: string | null;
  newState: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface DeliverableRow {
  id: string;
  key: string;
  templateKey: string | null;
  label: string;
  description: string | null;
  cMonthLabel: string | null;
  cMonthOffset: number | null;
  dueDateISO: string;
  scheduleType: DeliverableScheduleType;
  state: DeliverableState;
  evidence: DeliverableEvidenceItem[];
  isOverdue: boolean;
  overdueByDays: number;
  isHidden: boolean;
  comments: DeliverableComment[];
}

interface DeliverablesTableProps {
  deliverables: DeliverableRow[];
  skillId: string;
  canEdit: boolean;
  canValidate: boolean;
  overdueCount: number;
  stateCounts: Record<DeliverableState, number>;
  dueSoonThresholdDays: number;
  currentUserId: string;
  isAdmin: boolean;
}

type FilterKey = "all" | "overdue" | "dueSoon";

function getStatusIndicator(state: DeliverableState) {
  switch (state) {
    case DeliverableState.NotStarted:
      return { colorClass: "bg-destructive", label: formatDeliverableState(state) };
    case DeliverableState.Validated:
      return { colorClass: "bg-emerald-500", label: formatDeliverableState(state) };
    default:
      return { colorClass: "bg-amber-400", label: formatDeliverableState(state) };
  }
}

export function DeliverablesTable({
  deliverables,
  skillId,
  canEdit,
  canValidate,
  overdueCount,
  stateCounts,
  dueSoonThresholdDays,
  currentUserId,
  isAdmin
}: DeliverablesTableProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isExporting, startExport] = useTransition();
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);
  const [typeSelections, setTypeSelections] = useState<Record<string, EvidenceType>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  const handleTypeSelection = useCallback((deliverableId: string, type: EvidenceType) => {
    setTypeSelections((current) => ({ ...current, [deliverableId]: type }));
  }, []);

  const visibleDeliverables = useMemo(
    () => deliverables.filter((deliverable) => !deliverable.isHidden),
    [deliverables]
  );
  const hiddenDeliverables = useMemo(
    () => deliverables.filter((deliverable) => deliverable.isHidden),
    [deliverables]
  );

  const filteredDeliverables = useMemo(() => {
    const now = new Date();
    return visibleDeliverables.filter((deliverable) => {
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
  }, [visibleDeliverables, filter, dueSoonThresholdDays]);

  const dueSoonCount = useMemo(() => {
    const now = new Date();
    return visibleDeliverables.filter((deliverable) => {
      const dueDate = new Date(deliverable.dueDateISO);
      const daysUntilDue = differenceInCalendarDays(dueDate, now);
      return !deliverable.isOverdue && daysUntilDue >= 0 && daysUntilDue <= dueSoonThresholdDays;
    }).length;
  }, [visibleDeliverables, dueSoonThresholdDays]);

  const visibleCount = visibleDeliverables.length;
  const hiddenCount = hiddenDeliverables.length;

  const notStartedCount = stateCounts[DeliverableState.NotStarted] ?? 0;
  const inProgressCount =
    (stateCounts[DeliverableState.Draft] ?? 0) + (stateCounts[DeliverableState.InProgress] ?? 0);
  const completedCount =
    (stateCounts[DeliverableState.Finalised] ?? 0) +
    (stateCounts[DeliverableState.Uploaded] ?? 0) +
    (stateCounts[DeliverableState.Validated] ?? 0);

  const filterOptions = useMemo(
    () => [
      { key: "all" as const, label: "All deliverables" },
      { key: "overdue" as const, label: `Overdue (${overdueCount})` },
      { key: "dueSoon" as const, label: `Due soon (${dueSoonCount})` }
    ],
    [overdueCount, dueSoonCount]
  );

  const handleExport = () => {
    startExport(() => {
      const header =
        ["Label", "State", "Due date", "ScheduleType", "C-Month", "isOverdue", "overdueByDays"].join(",");
      const rows = visibleDeliverables.map((deliverable) => {
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
        <div className="space-y-3">
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
          <p className="text-xs text-muted-foreground">
            {hiddenCount > 0
              ? `${hiddenCount} hidden deliverable${hiddenCount === 1 ? "" : "s"} are excluded from these totals.`
              : `${visibleCount} deliverable${visibleCount === 1 ? "" : "s"} currently tracked in these totals.`}
          </p>
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

      {canEdit ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4">
          {isCreatingCustom ? (
            <CreateCustomDeliverableForm
              skillId={skillId}
              onCancel={() => {
                setIsCreatingCustom(false);
              }}
              onCreated={() => {
                setIsCreatingCustom(false);
              }}
            />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Need a bespoke deliverable?</p>
                <p className="text-xs text-muted-foreground">
                  Create a deliverable that only applies to this skill.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsCreatingCustom(true)}>
                Add custom deliverable
              </Button>
            </div>
          )}
        </div>
      ) : null}

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

      {visibleCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          All deliverables for this skill are currently hidden. Use the hidden deliverables panel below to
          review or restore them.
        </p>
      ) : filteredDeliverables.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deliverables match the selected filters.</p>
      ) : (
        <div className="space-y-4">
          {filteredDeliverables.map((deliverable) => {
            const dueDate = new Date(deliverable.dueDateISO);
            const daysUntilDue = differenceInCalendarDays(dueDate, new Date());
            const isDueSoon =
              !deliverable.isOverdue && daysUntilDue >= 0 && daysUntilDue <= dueSoonThresholdDays;
            const evidenceCount = deliverable.evidence.length;
            const documentEvidences = deliverable.evidence.filter((item) =>
              isDocumentEvidence(item)
            ) as DeliverableEvidenceDocument[];
            const evidenceEntries = deliverable.evidence.map((item, index) => ({ item, index }));
            const linkEvidence = evidenceEntries.filter(
              (
                entry
              ): entry is {
                item: Exclude<DeliverableEvidenceItem, DeliverableEvidenceDocument>;
                index: number;
              } => !isDocumentEvidence(entry.item)
            );
            const selectedEvidenceType =
              typeSelections[deliverable.id] ?? EVIDENCE_TYPE_OPTIONS[0].value;
            const { colorClass: statusColorClass, label: statusLabel } = getStatusIndicator(
              deliverable.state
            );
            const isCustom = !deliverable.templateKey;

            return (
              <details
                key={deliverable.id}
                className="group rounded-lg border bg-card shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <span>
                          {deliverable.scheduleType === DeliverableScheduleType.CMonth
                            ? deliverable.cMonthLabel ?? "C-month schedule"
                            : "Calendar date"}
                        </span>
                        {isCustom ? (
                          <span className="rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium normal-case text-muted-foreground">
                            Custom
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{deliverable.label}</h3>
                      {deliverable.description ? (
                        <p className="text-sm text-muted-foreground">{deliverable.description}</p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        Due {format(dueDate, "dd MMM yyyy")}
                        {isDueSoon ? ` · ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} remaining` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <div className="flex items-center gap-2 rounded-full border border-muted bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusColorClass}`} aria-hidden="true" />
                        <span>{statusLabel}</span>
                      </div>
                      {deliverable.isOverdue ? (
                        <Badge variant="destructive">Overdue by {deliverable.overdueByDays} days</Badge>
                      ) : isDueSoon ? (
                        <Badge variant="default">Due soon</Badge>
                      ) : (
                        <Badge variant="outline">On track</Badge>
                      )}
                      <Badge variant="outline">{evidenceCount} evidence</Badge>
                      {!canEdit ? (
                        <Badge variant="default">{formatDeliverableState(deliverable.state)}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-input">
                    <Plus className="h-4 w-4 group-open:hidden" aria-hidden="true" />
                    <Minus className="hidden h-4 w-4 group-open:block" aria-hidden="true" />
                  </div>
                </summary>
                <div className="border-t">
                  <div className="space-y-4 p-6">
                    {canEdit ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditingDeliverableId((current) =>
                              current === deliverable.id ? null : deliverable.id
                            )
                          }
                          className="text-xs"
                        >
                          {editingDeliverableId === deliverable.id ? "Cancel edit" : "Edit schedule"}
                        </Button>
                        <form
                          action={hideDeliverableAction}
                          onSubmit={(event) => {
                            if (!window.confirm("Hide this deliverable?")) {
                              event.preventDefault();
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="skillId" value={skillId} />
                          <input type="hidden" name="deliverableId" value={deliverable.id} />
                          <Button type="submit" variant="outline" size="sm" className="text-xs text-muted-foreground hover:text-destructive">
                            Hide deliverable
                          </Button>
                        </form>
                      </div>
                    ) : null}

                    {canEdit && editingDeliverableId === deliverable.id ? (
                      <div className="rounded-md border bg-muted/10 p-4">
                        <DeliverableScheduleEditor
                          deliverable={deliverable}
                          skillId={skillId}
                          onComplete={() => setEditingDeliverableId(null)}
                        />
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
                          {canEdit ? (
                            <DeliverableStateUpdater
                              deliverable={deliverable}
                              skillId={skillId}
                              canValidate={canValidate}
                            />
                          ) : (
                            <Badge variant="default" className="w-fit">
                              {formatDeliverableState(deliverable.state)}
                            </Badge>
                          )}
                        </div>

                        {/* Comment History */}
                        {deliverable.comments.length > 0 && (
                          <CommentHistory
                            comments={deliverable.comments}
                            skillId={skillId}
                            currentUserId={currentUserId}
                            isAdmin={isAdmin}
                          />
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Evidence</p>
                          {canEdit ? (
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <Label htmlFor={`new-evidence-type-${deliverable.id}`}>Evidence type</Label>
                                <select
                                  id={`new-evidence-type-${deliverable.id}`}
                                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  value={selectedEvidenceType}
                                  onChange={(event) =>
                                    handleTypeSelection(
                                      deliverable.id,
                                      event.target.value as EvidenceType
                                    )
                                  }
                                >
                                  {EVIDENCE_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {selectedEvidenceType !== "Document" ? (
                                <form
                                  action={appendEvidenceAction}
                                  className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
                                >
                                  <input type="hidden" name="skillId" value={skillId} />
                                  <input type="hidden" name="deliverableId" value={deliverable.id} />
                                  <input type="hidden" name="type" value={selectedEvidenceType} />
                                  <div className="flex w-full flex-col gap-2 md:flex-1">
                                    <Label htmlFor={`evidence-${deliverable.id}`} className="sr-only">
                                      Evidence URL
                                    </Label>
                                    <Input
                                      id={`evidence-${deliverable.id}`}
                                      type="url"
                                      name="evidence"
                                      placeholder="Paste a link to evidence"
                                      className="h-10 w-full"
                                      required
                                    />
                                  </div>
                                  <Button type="submit" variant="outline" size="sm" className="md:self-start">
                                    Attach link
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <DocumentEvidenceManager
                          deliverableId={deliverable.id}
                          skillId={skillId}
                          documents={documentEvidences}
                          canEdit={canEdit}
                          showUploader={canEdit && selectedEvidenceType === "Document"}
                        />

                        {linkEvidence.length > 0 ? (
                          <div className="space-y-2">
                            {linkEvidence.map(({ item, index }) => (
                              <div
                                key={`${deliverable.id}-${index}`}
                                className="rounded-md border border-muted bg-background p-3"
                              >
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm font-medium text-primary underline"
                                  >
                                    Evidence link
                                  </a>
                                  <Badge variant="outline" className="w-fit text-xs">
                                    {EVIDENCE_TYPE_LABELS[item.type] ?? item.type}
                                  </Badge>
                                </div>
                                {canEdit ? (
                                  <form
                                    className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                                    action={updateEvidenceTypeAction}
                                  >
                                    <input type="hidden" name="skillId" value={skillId} />
                                    <input type="hidden" name="deliverableId" value={deliverable.id} />
                                    <input type="hidden" name="evidenceIndex" value={index} />
                                    <Label htmlFor={`evidence-type-${deliverable.id}-${index}`} className="sr-only">
                                      Evidence type
                                    </Label>
                                    <select
                                      id={`evidence-type-${deliverable.id}-${index}`}
                                      name="type"
                                      defaultValue={item.type}
                                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                      {EVIDENCE_TYPE_OPTIONS.filter(
                                        (option) => option.value !== "Document"
                                      ).map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    <Button type="submit" size="sm" variant="secondary" className="text-xs">
                                      Update type
                                    </Button>
                                  </form>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No additional evidence attached.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Hidden deliverables</p>
              <p className="text-xs text-muted-foreground">
                Hidden deliverables are excluded from dashboards and reports.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowHidden((value) => !value)}>
              {showHidden ? "Hide list" : `Show (${hiddenCount})`}
            </Button>
          </div>
          {showHidden ? (
            <div className="mt-4 space-y-3">
              {hiddenDeliverables.map((deliverable) => {
                const dueDate = new Date(deliverable.dueDateISO);
                const isCustom = !deliverable.templateKey;
                return (
                  <div key={deliverable.id} className="rounded-md border bg-background p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <span>
                            {deliverable.scheduleType === DeliverableScheduleType.CMonth
                              ? deliverable.cMonthLabel ?? "C-month schedule"
                              : "Calendar date"}
                          </span>
                          {isCustom ? (
                            <span className="rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium normal-case text-muted-foreground">
                              Custom
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{deliverable.label}</p>
                        <p className="text-xs text-muted-foreground">Hidden · Due {format(dueDate, "dd MMM yyyy")}</p>
                      </div>
                      {canEdit ? (
                        <form
                          action={unhideDeliverableAction}
                          onSubmit={(event) => {
                            if (!window.confirm("Unhide this deliverable?")) {
                              event.preventDefault();
                            }
                          }}
                          className="flex items-center gap-2 self-start md:self-auto"
                        >
                          <input type="hidden" name="skillId" value={skillId} />
                          <input type="hidden" name="deliverableId" value={deliverable.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Unhide
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
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
        <DatePicker
          id={`due-${deliverable.id}`}
          name="dueDate"
          value={dueDate || null}
          onChange={(value) => {
            setDueDate(value ?? "");
            setError(null);
          }}
          disabled={isSaving || scheduleType === "cmonth"}
          required={scheduleType === "calendar"}
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

interface CreateCustomDeliverableFormProps {
  skillId: string;
  onCancel: () => void;
  onCreated: () => void;
}

function CreateCustomDeliverableForm({ skillId, onCancel, onCreated }: CreateCustomDeliverableFormProps) {
  const [scheduleType, setScheduleType] = useState<"calendar" | "cmonth">("calendar");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [offsetMonths, setOffsetMonths] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedLabel = label.trim();
    if (trimmedLabel.length < 3) {
      setError("Enter a deliverable label with at least 3 characters.");
      return;
    }

    if (scheduleType === "calendar" && !dueDate) {
      setError("Select a calendar due date.");
      return;
    }

    if (scheduleType === "cmonth" && offsetMonths.trim().length === 0) {
      setError("Enter the number of months before C1.");
      return;
    }

    const formData = new FormData();
    formData.append("skillId", skillId);
    formData.append("label", trimmedLabel);
    formData.append("scheduleType", scheduleType);

    if (scheduleType === "calendar") {
      formData.append("dueDate", dueDate);
    } else {
      formData.append("offsetMonths", offsetMonths.trim());
    }

    startTransition(async () => {
      try {
        await createCustomDeliverableAction(formData);
        setError(null);
        setLabel("");
        setDueDate("");
        setOffsetMonths("0");
        setScheduleType("calendar");
        onCreated();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to create deliverable");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`custom-label-${skillId}`}>Deliverable label</Label>
        <Input
          id={`custom-label-${skillId}`}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setError(null);
          }}
          placeholder="e.g. National training plan"
          disabled={isSaving}
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`custom-schedule-${skillId}`}>Schedule type</Label>
          <select
            id={`custom-schedule-${skillId}`}
            value={scheduleType}
            onChange={(event) => {
              const value = event.target.value as "calendar" | "cmonth";
              setScheduleType(value);
              setError(null);
              if (value === "calendar" && !dueDate) {
                setDueDate("");
              }
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={isSaving}
          >
            <option value="calendar">Calendar date</option>
            <option value="cmonth">C-month offset</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`custom-offset-${skillId}`}>Months before C1</Label>
          <Input
            id={`custom-offset-${skillId}`}
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
      </div>
      <div className="space-y-2">
        <Label htmlFor={`custom-due-${skillId}`}>Calendar due date</Label>
        <DatePicker
          id={`custom-due-${skillId}`}
          name="dueDate"
          value={dueDate || null}
          onChange={(value) => {
            setDueDate(value ?? "");
            setError(null);
          }}
          disabled={isSaving || scheduleType === "cmonth"}
          required={scheduleType === "calendar"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Creating..." : "Create deliverable"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setLabel("");
            setDueDate("");
            setOffsetMonths("0");
            setScheduleType("calendar");
            setError(null);
            onCancel();
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

interface DeliverableStateUpdaterProps {
  deliverable: DeliverableRow;
  skillId: string;
  canValidate: boolean;
}

function DeliverableStateUpdater({ deliverable, skillId, canValidate }: DeliverableStateUpdaterProps) {
  const [selectedState, setSelectedState] = useState<DeliverableState>(deliverable.state);
  const [comment, setComment] = useState("");
  const [isSaving, startTransition] = useTransition();

  const hasChanges = selectedState !== deliverable.state;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append("skillId", skillId);
    formData.append("deliverableId", deliverable.id);
    formData.append("state", selectedState);
    if (comment.trim()) {
      formData.append("comment", comment.trim());
    }

    startTransition(async () => {
      await updateDeliverableStateAction(formData);
      setComment("");
    });
  };

  const handleCancel = () => {
    setSelectedState(deliverable.state);
    setComment("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <select
          name="state"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value as DeliverableState)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-[220px]"
          disabled={isSaving}
        >
          {Object.values(DeliverableState).map((state) => (
            <option
              key={state}
              value={state}
              disabled={
                !canValidate &&
                state === DeliverableState.Validated &&
                deliverable.state !== DeliverableState.Validated
              }
            >
              {formatDeliverableState(state)}
            </option>
          ))}
        </select>
        {!hasChanges && (
          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            variant="secondary"
          >
            {isSaving ? "Updating..." : "Update"}
          </Button>
        )}
      </div>

      {hasChanges && (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="space-y-2">
            <Label htmlFor={`comment-${deliverable.id}`} className="text-sm font-medium text-amber-900">
              Add a comment about this change (optional)
            </Label>
            <Textarea
              id={`comment-${deliverable.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., Uploaded draft for review, waiting on final approval..."
              rows={2}
              className="resize-none bg-white text-sm"
              maxLength={1000}
              disabled={isSaving}
            />
            <p className="text-xs text-amber-700">
              Team members will be notified of this status change via email.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isSaving ? "Updating..." : "Update Status"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

interface CommentHistoryProps {
  comments: DeliverableComment[];
  skillId: string;
  currentUserId: string;
  isAdmin: boolean;
}

function CommentHistory({ comments, skillId, currentUserId, isAdmin }: CommentHistoryProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleStartEdit = (comment: DeliverableComment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.body);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText("");
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editText.trim()) return;

    const formData = new FormData();
    formData.append("commentId", commentId);
    formData.append("skillId", skillId);
    formData.append("body", editText.trim());

    startUpdateTransition(async () => {
      await updateDeliverableCommentAction(formData);
      setEditingCommentId(null);
      setEditText("");
    });
  };

  const handleDelete = (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;

    setDeletingId(commentId);
    const formData = new FormData();
    formData.append("commentId", commentId);
    formData.append("skillId", skillId);

    startDeleteTransition(async () => {
      await deleteDeliverableCommentAction(formData);
      setDeletingId(null);
    });
  };

  const canEditComment = (comment: DeliverableComment) => {
    return comment.user.id === currentUserId || isAdmin;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Status Change History ({comments.length})</span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {comments.map((comment) => {
          const isEditing = editingCommentId === comment.id;
          const canModify = canEditComment(comment);
          const wasEdited = comment.createdAt !== comment.updatedAt;

          return (
            <div
              key={comment.id}
              className="rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span className="font-medium text-foreground">
                      {comment.user.name ?? comment.user.email}
                    </span>
                    <span>·</span>
                    <span>{format(new Date(comment.createdAt), "dd MMM yyyy, h:mm a")}</span>
                    {wasEdited && (
                      <>
                        <span>·</span>
                        <span className="italic">edited</span>
                      </>
                    )}
                  </div>
                  {comment.previousState && comment.newState && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {formatDeliverableState(comment.previousState as DeliverableState)}
                      </Badge>
                      <span>→</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {formatDeliverableState(comment.newState as DeliverableState)}
                      </Badge>
                    </div>
                  )}
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                        maxLength={1000}
                        disabled={isUpdating}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={isUpdating || !editText.trim()}
                        >
                          {isUpdating ? (
                            "Saving..."
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-foreground">{comment.body}</p>
                  )}
                </div>
                {canModify && !isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleStartEdit(comment)}
                      disabled={isDeleting && deletingId === comment.id}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit comment</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(comment.id)}
                      disabled={isDeleting && deletingId === comment.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete comment</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
