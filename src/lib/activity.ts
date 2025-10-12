import { prisma } from "@/lib/prisma";

interface LogActivityParams {
  skillId: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
}

export async function logActivity({ skillId, userId, action, payload }: LogActivityParams) {
  await prisma.activityLog.create({
    data: {
      skillId,
      userId,
      action,
      payload
    }
  });
}
