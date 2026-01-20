import { DeliverableState } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decorateDeliverable } from "@/lib/deliverables";

interface Column {
  id: string;
  title: string;
  description: string;
  states: DeliverableState[];
  color: string;
}

const COLUMNS: Column[] = [
  {
    id: "upcoming",
    title: "Upcoming",
    description: "Not started or in draft",
    states: [DeliverableState.NotStarted, DeliverableState.Draft],
    color: "bg-slate-100 dark:bg-slate-800",
  },
  {
    id: "in-progress",
    title: "In Progress",
    description: "Currently being worked on",
    states: [DeliverableState.InProgress],
    color: "bg-blue-50 dark:bg-blue-950",
  },
  {
    id: "needs-review",
    title: "Needs Review",
    description: "Uploaded or finalised",
    states: [DeliverableState.Uploaded, DeliverableState.Finalised],
    color: "bg-amber-50 dark:bg-amber-950",
  },
  {
    id: "done",
    title: "Done",
    description: "Validated and complete",
    states: [DeliverableState.Validated],
    color: "bg-green-50 dark:bg-green-950",
  },
];

export default async function QCPipelinePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const skills = await prisma.skill.findMany({
    where: { saId: user.id },
    include: {
      deliverables: true,
    },
    orderBy: { name: "asc" },
  });

  const decoratedSkills = skills.map((skill) => ({
    ...skill,
    deliverables: skill.deliverables
      .filter((d) => !d.isHidden)
      .map((d) => decorateDeliverable(d)),
  }));

  const allDeliverables = decoratedSkills.flatMap((skill) =>
    skill.deliverables.map((deliverable) => ({ deliverable, skill }))
  );

  const columnData = COLUMNS.map((column) => ({
    ...column,
    items: allDeliverables
      .filter(({ deliverable }) => column.states.includes(deliverable.state))
      .sort(
        (a, b) =>
          a.deliverable.dueDate.getTime() - b.deliverable.dueDate.getTime()
      ),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Quality Control Pipeline
        </h1>
        <p className="mt-2 text-muted-foreground">
          Track your deliverables through the review process.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {columnData.map((column) => (
          <Card key={column.id} className={column.color}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{column.title}</CardTitle>
                <Badge variant="outline">{column.items.length}</Badge>
              </div>
              <CardDescription>{column.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {column.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No deliverables in this stage.
                </p>
              ) : (
                <ul className="space-y-2">
                  {column.items.map(({ deliverable, skill }) => (
                    <li key={deliverable.id}>
                      <Link
                        href={`/skills/${skill.id}`}
                        className="block rounded-md border bg-background p-3 transition-colors hover:bg-muted"
                      >
                        <p className="font-medium leading-tight">
                          {deliverable.label}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {skill.name}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className={`text-xs ${deliverable.isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            Due {format(deliverable.dueDate, "dd MMM")}
                          </span>
                          {deliverable.isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
