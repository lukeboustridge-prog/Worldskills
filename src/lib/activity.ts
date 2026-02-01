import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface LogActivityParams {
  skillId: string | null;
  userId: string;
  action: string;
  payload?: Prisma.InputJsonValue;
}

export async function logActivity({
  skillId,
  userId,
  action,
  payload
}: LogActivityParams) {
  await prisma.activityLog.create({
    data: {
      // Use sentinel value for management meetings until schema migrated
      // TODO: Migrate ActivityLog.skillId to optional in future schema change
      skillId: skillId ?? "MANAGEMENT",
      userId,
      action,
      payload: payload ?? Prisma.JsonNull
    }
  });
}
