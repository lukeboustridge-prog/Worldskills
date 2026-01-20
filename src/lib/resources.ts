import { ResourceCategory } from "@prisma/client";
import { prisma } from "./prisma";

export async function getResourcesByCategory(category: ResourceCategory) {
  return prisma.resourceLink.findMany({
    where: { category },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function getFeaturedResources() {
  return prisma.resourceLink.findMany({
    where: { isFeatured: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function getAllResources() {
  return prisma.resourceLink.findMany({
    orderBy: [{ category: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
}

export async function getResourceById(id: string) {
  return prisma.resourceLink.findUnique({
    where: { id },
  });
}
