"use client";

import { Role } from "@prisma/client";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SkillStat {
  id: string;
  name: string;
  toDo: number;
  inProgress: number;
  review: number;
  complete: number;
  total: number;
  overdue: number;
  completionPercent: number;
}

interface SkillsMatrixViewProps {
  skills: SkillStat[];
  userRole: Role;
  isAdmin: boolean;
  cohortAveragePercent: number;
  userSkillCompletionPercent: number;
  benchmarkDifference: number;
}

function BenchmarkingWidget({
  cohortAveragePercent,
  userSkillCompletionPercent,
  benchmarkDifference,
}: {
  cohortAveragePercent: number;
  userSkillCompletionPercent: number;
  benchmarkDifference: number;
}) {
  const isAhead = benchmarkDifference > 0;
  const isBehind = benchmarkDifference < 0;
  const isEqual = benchmarkDifference === 0;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>Benchmarking</span>
          {isAhead && <TrendingUp className="h-5 w-5 text-green-600" />}
          {isBehind && <TrendingDown className="h-5 w-5 text-red-600" />}
          {isEqual && <Minus className="h-5 w-5 text-muted-foreground" />}
        </CardTitle>
        <CardDescription>
          Compare your skill&apos;s progress against the cohort average
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Cohort Average</p>
            <p className="text-2xl font-bold">{cohortAveragePercent}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Skill</p>
            <p className="text-2xl font-bold">{userSkillCompletionPercent}%</p>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <p
              className={cn(
                "text-lg font-semibold",
                isAhead && "text-green-600",
                isBehind && "text-red-600",
                isEqual && "text-muted-foreground"
              )}
            >
              {isEqual
                ? "On par with cohort"
                : `You are ${Math.abs(benchmarkDifference)}% ${isAhead ? "ahead" : "behind"}`}
            </p>
          </div>
        </div>

        {/* Progress comparison bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-24 text-muted-foreground">Cohort</span>
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-muted-foreground/50 rounded-full transition-all"
                style={{ width: `${cohortAveragePercent}%` }}
              />
            </div>
            <span className="w-12 text-right text-muted-foreground">
              {cohortAveragePercent}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-24 text-muted-foreground">Your Skill</span>
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isAhead ? "bg-green-500" : isBehind ? "bg-red-500" : "bg-primary"
                )}
                style={{ width: `${userSkillCompletionPercent}%` }}
              />
            </div>
            <span className="w-12 text-right font-medium">
              {userSkillCompletionPercent}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIndicator({ hasOverdue }: { hasOverdue: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-3 w-3 rounded-full",
          hasOverdue ? "bg-red-500" : "bg-green-500"
        )}
      />
      <span className={cn("text-sm", hasOverdue ? "text-red-600" : "text-green-600")}>
        {hasOverdue ? "At Risk" : "On Track"}
      </span>
    </div>
  );
}

export function SkillsMatrixView({
  skills,
  userRole,
  isAdmin,
  cohortAveragePercent,
  userSkillCompletionPercent,
  benchmarkDifference,
}: SkillsMatrixViewProps) {
  const isSCM = (userRole === Role.SCM || userRole === Role.SkillTeam) && !isAdmin;
  const totalDeliverables = skills.reduce((sum, s) => sum + s.total, 0);
  const totalComplete = skills.reduce((sum, s) => sum + s.complete, 0);
  const totalOverdue = skills.reduce((sum, s) => sum + s.overdue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Skills Matrix</h1>
        <p className="mt-2 text-muted-foreground">
          {isSCM
            ? "Monitor your assigned skill's deliverable progress."
            : "Monitor deliverable progress across your skills at a glance."}
        </p>
      </div>

      {/* Benchmarking Widget - Only for SCM/Skill Team users */}
      {isSCM && skills.length > 0 && (
        <BenchmarkingWidget
          cohortAveragePercent={cohortAveragePercent}
          userSkillCompletionPercent={userSkillCompletionPercent}
          benchmarkDifference={benchmarkDifference}
        />
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Skills</CardDescription>
            <CardTitle className="text-2xl">{skills.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deliverables</CardDescription>
            <CardTitle className="text-2xl">{totalDeliverables}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl text-green-600">{totalComplete}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className={cn("text-2xl", totalOverdue > 0 && "text-red-600")}>
              {totalOverdue}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deliverable Status by Skill</CardTitle>
          <CardDescription>
            Overview of deliverable progress across all tracked skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {isSCM
                ? "You are not currently assigned to any skill."
                : "No skills found. You may need to be assigned as a Skill Advisor or Skill Team member."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Skill Name</TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex flex-col items-center">
                        <span>To Do</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Not Started / Draft
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex flex-col items-center">
                        <span>In Progress</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex flex-col items-center">
                        <span>Review</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Uploaded / Finalised
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-24">
                      <div className="flex flex-col items-center">
                        <span>Complete</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Validated
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skills.map((skill) => (
                    <TableRow key={skill.id}>
                      <TableCell>
                        <Link
                          href={`/skills/${skill.id}`}
                          className="font-medium hover:underline"
                        >
                          {skill.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {skill.completionPercent}% complete
                          </Badge>
                          {skill.overdue > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {skill.overdue} overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-md font-medium",
                            skill.toDo > 0
                              ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              : "text-muted-foreground"
                          )}
                        >
                          {skill.toDo}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-md font-medium",
                            skill.inProgress > 0
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "text-muted-foreground"
                          )}
                        >
                          {skill.inProgress}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-md font-medium",
                            skill.review > 0
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                              : "text-muted-foreground"
                          )}
                        >
                          {skill.review}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-md font-medium",
                            skill.complete > 0
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "text-muted-foreground"
                          )}
                        >
                          {skill.complete}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIndicator hasOverdue={skill.overdue > 0} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>On Track - No overdue deliverables</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>At Risk - Has overdue deliverables</span>
        </div>
      </div>
    </div>
  );
}
