import { DeliverableState, Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decorateDeliverable } from "@/lib/deliverables";
import { SkillsMatrixView } from "./skills-matrix-view";

export default async function SkillsMatrixPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Role-based data fetching
  // SA: All skills they manage
  // SCM: Only their assigned skill
  // Admin/Secretariat: All skills (for now, same as SA view)
  let userSkillsQuery = {};
  if (user.role === Role.SCM) {
    userSkillsQuery = { scmId: user.id };
  } else if (user.role === Role.SA) {
    userSkillsQuery = { saId: user.id };
  } else if (user.isAdmin || user.role === Role.Secretariat) {
    // Admin/Secretariat can see all skills
    userSkillsQuery = {};
  }

  const userSkills = await prisma.skill.findMany({
    where: userSkillsQuery,
    include: {
      deliverables: true,
    },
    orderBy: { name: "asc" },
  });

  // For SCM users, also fetch all skills to calculate cohort average
  let allSkills = userSkills;
  if (user.role === Role.SCM) {
    allSkills = await prisma.skill.findMany({
      include: {
        deliverables: true,
      },
    });
  }

  // Calculate stats for each skill
  const skillStats = userSkills.map((skill) => {
    const visibleDeliverables = skill.deliverables.filter((d) => !d.isHidden);
    const decoratedDeliverables = visibleDeliverables.map((d) => decorateDeliverable(d));

    const toDo = decoratedDeliverables.filter(
      (d) => d.state === DeliverableState.NotStarted || d.state === DeliverableState.Draft
    ).length;

    const inProgress = decoratedDeliverables.filter(
      (d) => d.state === DeliverableState.InProgress
    ).length;

    const review = decoratedDeliverables.filter(
      (d) => d.state === DeliverableState.Uploaded || d.state === DeliverableState.Finalised
    ).length;

    const complete = decoratedDeliverables.filter(
      (d) => d.state === DeliverableState.Validated
    ).length;

    const overdue = decoratedDeliverables.filter((d) => d.isOverdue).length;

    const total = decoratedDeliverables.length;
    const completionPercent = total > 0 ? Math.round((complete / total) * 100) : 0;

    return {
      id: skill.id,
      name: skill.name,
      toDo,
      inProgress,
      review,
      complete,
      total,
      overdue,
      completionPercent,
    };
  });

  // Calculate cohort average for SCM benchmarking
  let cohortAveragePercent = 0;
  let userSkillCompletionPercent = 0;
  let benchmarkDifference = 0;

  if (user.role === Role.SCM && allSkills.length > 0) {
    // Calculate cohort average
    const cohortStats = allSkills.map((skill) => {
      const visibleDeliverables = skill.deliverables.filter((d) => !d.isHidden);
      const decoratedDeliverables = visibleDeliverables.map((d) => decorateDeliverable(d));
      const complete = decoratedDeliverables.filter(
        (d) => d.state === DeliverableState.Validated
      ).length;
      const total = decoratedDeliverables.length;
      return total > 0 ? (complete / total) * 100 : 0;
    });

    cohortAveragePercent = Math.round(
      cohortStats.reduce((sum, pct) => sum + pct, 0) / cohortStats.length
    );

    // User's skill completion
    if (skillStats.length > 0) {
      userSkillCompletionPercent = skillStats[0].completionPercent;
      benchmarkDifference = userSkillCompletionPercent - cohortAveragePercent;
    }
  }

  return (
    <SkillsMatrixView
      skills={skillStats}
      userRole={user.role}
      isAdmin={user.isAdmin}
      cohortAveragePercent={cohortAveragePercent}
      userSkillCompletionPercent={userSkillCompletionPercent}
      benchmarkDifference={benchmarkDifference}
    />
  );
}
