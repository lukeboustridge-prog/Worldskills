import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface LogActivityParams {
  skillId: string;
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
      skillId,
      userId,
      action,
      payload: payload ?? Prisma.JsonNull
    }
  });
}
