import { DeliverableState } from "@prisma/client";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decorateDeliverable } from "@/lib/deliverables";
import { ProgressBoard } from "./progress-board";

export default async function ProgressPage() {
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
    id: skill.id,
    name: skill.name,
    deliverables: skill.deliverables
      .filter((d) => !d.isHidden)
      .map((d) => {
        const decorated = decorateDeliverable(d);
        return {
          id: decorated.id,
          label: decorated.label,
          state: decorated.state,
          dueDate: decorated.dueDate.toISOString(),
          isOverdue: decorated.isOverdue,
        };
      }),
  }));

  return <ProgressBoard skills={decoratedSkills} />;
}
