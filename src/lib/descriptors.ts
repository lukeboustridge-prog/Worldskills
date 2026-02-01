import { prisma } from "@/lib/prisma";
import { QualityIndicator } from "@prisma/client";

export interface DescriptorFilters {
  skillName?: string;
  sector?: string;
  category?: string;
  qualityIndicator?: QualityIndicator;
  tag?: string;
  search?: string;
  includeDeleted?: boolean;
}

/**
 * Get all descriptors with optional filtering.
 * By default excludes soft-deleted descriptors.
 */
export async function getAllDescriptors(filters: DescriptorFilters = {}) {
  const where: any = {};

  // Always filter out deleted unless explicitly requested
  if (!filters.includeDeleted) {
    where.deletedAt = null;
  }

  if (filters.skillName) {
    where.skillName = filters.skillName;
  }

  if (filters.sector) {
    where.sector = filters.sector;
  }

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.qualityIndicator) {
    where.qualityIndicator = filters.qualityIndicator;
  }

  if (filters.tag) {
    where.tags = { has: filters.tag };
  }

  if (filters.search) {
    where.OR = [
      { criterionName: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
      { score3: { contains: filters.search, mode: "insensitive" } },
      { score2: { contains: filters.search, mode: "insensitive" } },
      { score1: { contains: filters.search, mode: "insensitive" } },
      { score0: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.descriptor.findMany({
    where,
    orderBy: [
      { skillName: "asc" },
      { code: "asc" },
    ],
  });
}

/**
 * Get a single descriptor by ID.
 * Returns null if not found or soft-deleted (unless includeDeleted=true).
 */
export async function getDescriptorById(id: string, includeDeleted = false) {
  const descriptor = await prisma.descriptor.findUnique({
    where: { id },
  });

  if (!descriptor) return null;
  if (!includeDeleted && descriptor.deletedAt) return null;

  return descriptor;
}

/**
 * Get distinct values for filter dropdowns.
 */
export async function getDescriptorFilterOptions() {
  const [skills, sectors, categories, tags] = await Promise.all([
    prisma.descriptor.findMany({
      where: { deletedAt: null },
      select: { skillName: true },
      distinct: ["skillName"],
      orderBy: { skillName: "asc" },
    }),
    prisma.descriptor.findMany({
      where: { deletedAt: null, sector: { not: null } },
      select: { sector: true },
      distinct: ["sector"],
      orderBy: { sector: "asc" },
    }),
    prisma.descriptor.findMany({
      where: { deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    // Get unique tags (requires raw query since tags is array)
    prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest(tags) as tag
      FROM "Descriptor"
      WHERE "deletedAt" IS NULL
      ORDER BY tag
    `,
  ]);

  return {
    skills: skills.map((s) => s.skillName),
    sectors: sectors.map((s) => s.sector!),
    categories: categories.map((c) => c.category!),
    tags: tags.map((t) => t.tag),
  };
}
