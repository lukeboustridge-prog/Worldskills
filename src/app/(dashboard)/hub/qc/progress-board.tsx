"use client";

import { useState } from "react";
import { DeliverableState } from "@prisma/client";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Filter, LayoutGrid, List } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Deliverable {
  id: string;
  label: string;
  state: DeliverableState;
  dueDate: string;
  isOverdue: boolean;
}

interface Skill {
  id: string;
  name: string;
  deliverables: Deliverable[];
}

interface ProgressBoardProps {
  skills: Skill[];
}

interface Column {
  id: string;
  title: string;
  description: string;
  states: DeliverableState[];
  color: string;
  bgColor: string;
}

const COLUMNS: Column[] = [
  {
    id: "upcoming",
    title: "To Do",
    description: "Not started or in draft",
    states: [DeliverableState.NotStarted, DeliverableState.Draft],
    color: "border-slate-300 dark:border-slate-600",
    bgColor: "bg-slate-50 dark:bg-slate-900",
  },
  {
    id: "in-progress",
    title: "In Progress",
    description: "Currently being worked on",
    states: [DeliverableState.InProgress],
    color: "border-blue-300 dark:border-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    id: "needs-review",
    title: "Review",
    description: "Uploaded or finalised",
    states: [DeliverableState.Uploaded, DeliverableState.Finalised],
    color: "border-amber-300 dark:border-amber-700",
    bgColor: "bg-amber-50 dark:bg-amber-950",
  },
  {
    id: "done",
    title: "Complete",
    description: "Validated",
    states: [DeliverableState.Validated],
    color: "border-green-300 dark:border-green-700",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
];

export function ProgressBoard({ skills }: ProgressBoardProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | "all">("all");
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(["done"]));
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [groupBySkill, setGroupBySkill] = useState(false);

  const filteredSkills = selectedSkillId === "all"
    ? skills
    : skills.filter((s) => s.id === selectedSkillId);

  const allDeliverables = filteredSkills.flatMap((skill) =>
    skill.deliverables.map((deliverable) => ({ deliverable, skill }))
  );

  const columnData = COLUMNS.map((column) => ({
    ...column,
    items: allDeliverables
      .filter(({ deliverable }) => column.states.includes(deliverable.state))
      .sort((a, b) => new Date(a.deliverable.dueDate).getTime() - new Date(b.deliverable.dueDate).getTime()),
  }));

  const toggleColumn = (columnId: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const totalDeliverables = allDeliverables.length;
  const overdueCount = allDeliverables.filter(({ deliverable }) => deliverable.isOverdue).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Progress</h1>
        <p className="mt-2 text-muted-foreground">
          Track your deliverables across all stages.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="flex flex-wrap gap-4">
        {columnData.map((column) => (
          <div key={column.id} className="flex items-center gap-2">
            <div className={cn("h-3 w-3 rounded-full", column.bgColor, "border", column.color)} />
            <span className="text-sm">
              {column.title}: <span className="font-medium">{column.items.length}</span>
            </span>
          </div>
        ))}
        {overdueCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-sm text-destructive">
              Overdue: <span className="font-medium">{overdueCount}</span>
            </span>
          </div>
        )}
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedSkillId}
            onChange={(e) => setSelectedSkillId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Skills ({skills.length})</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name} ({skill.deliverables.length})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-1">
          <Button
            variant={viewMode === "board" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("board")}
            className="h-7 px-2"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-7 px-2"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {viewMode === "board" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={groupBySkill}
              onChange={(e) => setGroupBySkill(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Group by skill
          </label>
        )}
      </div>

      {viewMode === "board" ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {columnData.map((column) => {
            const isCollapsed = collapsedColumns.has(column.id);
            const itemsBySkill = groupBySkill
              ? filteredSkills.map((skill) => ({
                  skill,
                  items: column.items.filter((item) => item.skill.id === skill.id),
                })).filter((group) => group.items.length > 0)
              : null;

            return (
              <Card key={column.id} className={cn("border-t-4", column.color)}>
                <CardHeader
                  className="cursor-pointer pb-3"
                  onClick={() => toggleColumn(column.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <CardTitle className="text-lg">{column.title}</CardTitle>
                    </div>
                    <Badge variant="outline">{column.items.length}</Badge>
                  </div>
                  {!isCollapsed && (
                    <CardDescription>{column.description}</CardDescription>
                  )}
                </CardHeader>

                {!isCollapsed && (
                  <CardContent className="max-h-[60vh] overflow-y-auto">
                    {column.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No deliverables here.
                      </p>
                    ) : groupBySkill && itemsBySkill ? (
                      <div className="space-y-4">
                        {itemsBySkill.map(({ skill, items }) => (
                          <div key={skill.id}>
                            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {skill.name}
                            </p>
                            <ul className="space-y-1.5">
                              {items.map(({ deliverable }) => (
                                <DeliverableItem
                                  key={deliverable.id}
                                  deliverable={deliverable}
                                  skillId={skill.id}
                                  showSkillName={false}
                                />
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ul className="space-y-1.5">
                        {column.items.map(({ deliverable, skill }) => (
                          <DeliverableItem
                            key={deliverable.id}
                            deliverable={deliverable}
                            skillId={skill.id}
                            skillName={skill.name}
                            showSkillName={selectedSkillId === "all"}
                          />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {totalDeliverables === 0 ? (
              <p className="text-sm text-muted-foreground">No deliverables found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium">Deliverable</th>
                      {selectedSkillId === "all" && (
                        <th className="pb-2 pr-4 font-medium">Skill</th>
                      )}
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDeliverables
                      .sort((a, b) => new Date(a.deliverable.dueDate).getTime() - new Date(b.deliverable.dueDate).getTime())
                      .map(({ deliverable, skill }) => (
                        <tr key={deliverable.id} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <Link
                              href={`/skills/${skill.id}`}
                              className="font-medium hover:underline"
                            >
                              {deliverable.label}
                            </Link>
                          </td>
                          {selectedSkillId === "all" && (
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {skill.name}
                            </td>
                          )}
                          <td className="py-2.5 pr-4">
                            <StatusBadge state={deliverable.state} isOverdue={deliverable.isOverdue} />
                          </td>
                          <td className="py-2.5">
                            <span className={deliverable.isOverdue ? "text-destructive" : ""}>
                              {format(new Date(deliverable.dueDate), "dd MMM yyyy")}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeliverableItem({
  deliverable,
  skillId,
  skillName,
  showSkillName = true,
}: {
  deliverable: Deliverable;
  skillId: string;
  skillName?: string;
  showSkillName?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/skills/${skillId}`}
        className={cn(
          "block rounded-md border bg-background p-2.5 transition-colors hover:bg-muted",
          deliverable.isOverdue && "border-destructive/50"
        )}
      >
        <p className="font-medium leading-tight text-sm">{deliverable.label}</p>
        {showSkillName && skillName && (
          <p className="mt-0.5 text-xs text-muted-foreground">{skillName}</p>
        )}
        <div className="mt-1.5 flex items-center justify-between">
          <span
            className={cn(
              "text-xs",
              deliverable.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
            )}
          >
            {deliverable.isOverdue ? "Overdue" : format(new Date(deliverable.dueDate), "dd MMM")}
          </span>
        </div>
      </Link>
    </li>
  );
}

function StatusBadge({ state, isOverdue }: { state: DeliverableState; isOverdue: boolean }) {
  if (isOverdue) {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  const config: Record<DeliverableState, { label: string; variant: "default" | "outline" }> = {
    [DeliverableState.NotStarted]: { label: "Not Started", variant: "outline" },
    [DeliverableState.Draft]: { label: "Draft", variant: "outline" },
    [DeliverableState.InProgress]: { label: "In Progress", variant: "default" },
    [DeliverableState.Uploaded]: { label: "Uploaded", variant: "default" },
    [DeliverableState.Finalised]: { label: "Finalised", variant: "default" },
    [DeliverableState.Validated]: { label: "Validated", variant: "outline" },
  };

  const { label, variant } = config[state];
  return <Badge variant={variant}>{label}</Badge>;
}
