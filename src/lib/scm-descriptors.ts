import { DescriptorBatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Get all descriptors created by an SCM, with batch status grouping.
 * Includes wsosSection for display.
 *
 * @param userId - The SCM's user ID
 * @returns Descriptors ordered by batchStatus (DRAFT first) then updatedAt DESC
 */
export async function getSCMDescriptors(userId: string) {
  return prisma.descriptor.findMany({
    where: {
      createdById: userId,
      deletedAt: null,
    },
    include: {
      wsosSection: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { batchStatus: "asc" }, // DRAFT < PENDING_REVIEW < APPROVED < RETURNED
      { updatedAt: "desc" },
    ],
  });
}

export type SCMDescriptor = Awaited<ReturnType<typeof getSCMDescriptors>>[number];

/**
 * Get only DRAFT descriptors for an SCM (not yet submitted).
 * Used for the "Draft Batch" section of My Descriptors page.
 *
 * @param userId - The SCM's user ID
 * @returns Draft descriptors ordered by createdAt DESC (newest first)
 */
export async function getDraftDescriptors(userId: string) {
  return prisma.descriptor.findMany({
    where: {
      createdById: userId,
      batchStatus: DescriptorBatchStatus.DRAFT,
      deletedAt: null,
    },
    include: {
      wsosSection: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single descriptor by ID, but only if created by the specified user.
 * Used for edit page authorization.
 *
 * @param id - Descriptor ID
 * @param userId - The SCM's user ID (must match createdById)
 * @returns Descriptor or null if not found/not owned by user
 */
export async function getSCMDescriptorById(id: string, userId: string) {
  return prisma.descriptor.findFirst({
    where: {
      id,
      createdById: userId,
      deletedAt: null,
    },
    include: {
      wsosSection: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Count descriptors by batch status for an SCM.
 * Used for dashboard summary or badge counts.
 *
 * @param userId - The SCM's user ID
 * @returns Object with counts per status
 */
export async function getSCMDescriptorCounts(userId: string) {
  const results = await prisma.descriptor.groupBy({
    by: ["batchStatus"],
    where: {
      createdById: userId,
      deletedAt: null,
    },
    _count: true,
  });

  // Convert to a more usable format
  const counts: Record<string, number> = {
    DRAFT: 0,
    PENDING_REVIEW: 0,
    APPROVED: 0,
    RETURNED: 0,
  };

  for (const result of results) {
    if (result.batchStatus) {
      counts[result.batchStatus] = result._count;
    }
  }

  return counts;
}
