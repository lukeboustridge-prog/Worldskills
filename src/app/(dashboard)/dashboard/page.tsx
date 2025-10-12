import { Role } from "@prisma/client";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDeliverableState, formatDeliverableType } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const skills = await prisma.skill.findMany({
    where: user.role === Role.SA ? { saId: user.id } : { scmId: user.id },
    include: {
      deliverables: true,
      gates: true,
      scm: true,
      sa: true
    },
    orderBy: { createdAt: "desc" }
  });

  const firstSkill = user.role === Role.SCM ? skills[0] : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            {user.role === Role.SA
              ? "Overview of all skills and deliverables you manage."
              : "Latest progress for your WorldSkills skill."}
          </p>
        </div>
        {user.role === Role.SA ? (
          <Button asChild>
            <Link href="/skills">Manage skills</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {skills.map((skill) => {
          const completedDeliverables = skill.deliverables.filter((d) =>
            ["Finalised", "Uploaded", "Validated"].includes(d.state)
          );
          const totalDeliverables = skill.deliverables.length || 1;
          const completedGates = skill.gates.filter((gate) => gate.status === "Complete");

          return (
            <Card key={skill.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{skill.name}</CardTitle>
                    <CardDescription>
                      SA: {skill.sa.name ?? skill.sa.email} · SCM: {skill.scm.name ?? skill.scm.email}
                    </CardDescription>
                  </div>
                  <Badge>
                    {completedDeliverables.length}/{totalDeliverables} deliverables
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>{skill.notes ? skill.notes.slice(0, 180) : "No notes yet."}</p>
                <div className="flex items-center justify-between text-xs">
                  <span>Gates complete</span>
                  <span>
                    {completedGates.length}/{skill.gates.length}
                  </span>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/skills/${skill.id}`}>Open skill workspace</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {user.role === Role.SCM && firstSkill ? (
        <Card>
          <CardHeader>
            <CardTitle>Next actions</CardTitle>
            <CardDescription>
              Keep your SA updated with evidence and comments as you complete deliverables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {firstSkill.deliverables.length === 0 ? (
              <p className="text-muted-foreground">No deliverables created yet.</p>
            ) : (
              firstSkill.deliverables.map((deliverable) => (
                <div key={deliverable.id} className="rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{formatDeliverableType(deliverable.type)}</p>
                    <Badge variant="outline">{formatDeliverableState(deliverable.state)}</Badge>
                  </div>
                  {deliverable.evidenceLinks.length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {deliverable.evidenceLinks.map((link, index) => (
                        <li key={index}>
                          <a href={link} className="underline" target="_blank" rel="noreferrer">
                            Evidence #{index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No evidence uploaded yet.</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
