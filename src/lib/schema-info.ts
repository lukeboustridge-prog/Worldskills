import { prisma } from "@/lib/prisma";

interface ExistenceResult {
  exists: boolean;
}

async function queryTableExists(tableName: string) {
  const result = await prisma.$queryRaw<ExistenceResult[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ${tableName}
    ) AS "exists"
  `;

  return Boolean(result[0]?.exists);
}

async function queryColumnExists(tableName: string, columnName: string) {
  const result = await prisma.$queryRaw<ExistenceResult[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS "exists"
  `;

  return Boolean(result[0]?.exists);
}

export async function hasMilestoneTemplateCatalogSupport() {
  const [tableExists, columnExists] = await Promise.all([
    queryTableExists("GateTemplate"),
    queryColumnExists("Gate", "templateKey")
  ]);

  return tableExists && columnExists;
}

export async function hasInvitationTable() {
  return queryTableExists("Invitation");
}
