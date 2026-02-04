import { DescriptorBatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Get pending descriptors for SA to review.
 * Implements APPR-01: SA sees pending descriptors from their skill's SCM.
 *
 * Flow:
 * 1. Find all skills where this SA is assigned (saId = userId)
 * 2. Extract SCM IDs from those skills
 * 3. Find PENDING_REVIEW descriptors created by those SCMs
 */
export async function getPendingDescriptorsForSA(saUserId: string) {
  // Find all SCM user IDs for skills this SA manages
  const skills = await prisma.skill.findMany({
    where: { saId: saUserId },
    select: { scmId: true, name: true },
  });

  const scmIds = skills
    .map((s) => s.scmId)
    .filter((id): id is string => id !== null);

  if (scmIds.length === 0) {
    return [];
  }

  // Find PENDING_REVIEW descriptors created by those SCMs
  return prisma.descriptor.findMany({
    where: {
      createdById: { in: scmIds },
      batchStatus: DescriptorBatchStatus.PENDING_REVIEW,
      deletedAt: null,
    },
    include: {
      wsosSection: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [
      { submittedAt: "asc" }, // Oldest first (FIFO review)
      { createdAt: "asc" },
    ],
  });
}

export type PendingDescriptor = Awaited<
  ReturnType<typeof getPendingDescriptorsForSA>
>[number];

/**
 * Get counts of pending descriptors for SA.
 * Useful for badge counts in navigation.
 */
export async function getPendingCountsForSA(saUserId: string) {
  const skills = await prisma.skill.findMany({
    where: { saId: saUserId },
    select: { scmId: true },
  });

  const scmIds = skills
    .map((s) => s.scmId)
    .filter((id): id is string => id !== null);

  if (scmIds.length === 0) {
    return { total: 0 };
  }

  const count = await prisma.descriptor.count({
    where: {
      createdById: { in: scmIds },
      batchStatus: DescriptorBatchStatus.PENDING_REVIEW,
      deletedAt: null,
    },
  });

  return { total: count };
}

/**
 * Check if SA can review a specific descriptor.
 * Validates:
 * 1. Descriptor exists and is in PENDING_REVIEW status
 * 2. Descriptor was created by an SCM assigned to a skill the SA manages
 */
export async function canSAReviewDescriptor(
  saUserId: string,
  descriptorId: string
): Promise<boolean> {
  const descriptor = await prisma.descriptor.findUnique({
    where: { id: descriptorId },
    select: { createdById: true, batchStatus: true },
  });

  if (!descriptor?.createdById) return false;
  if (descriptor.batchStatus !== DescriptorBatchStatus.PENDING_REVIEW)
    return false;

  // Check if SA manages a skill with this SCM
  const skill = await prisma.skill.findFirst({
    where: {
      saId: saUserId,
      scmId: descriptor.createdById,
    },
  });

  return skill !== null;
}
