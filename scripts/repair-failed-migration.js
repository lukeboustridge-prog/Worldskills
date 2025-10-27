const { PrismaClient, Prisma } = require('@prisma/client');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[repair-failed-migration] DATABASE_URL is not set, skipping repair step.');
    return;
  }

  const prisma = new PrismaClient();
  const migrationsToRepair = [
    '0004_deliverable_schedule',
    '0005_admin_flag_and_templates',
    '0009_pending_role',
  ];

  try {
    const tableCheck = await prisma.$queryRaw(
      Prisma.sql`SELECT to_regclass('_prisma_migrations') IS NOT NULL AS "exists"`
    );
    const tableExistsValue = tableCheck?.[0]?.exists;
    const tableExists = tableExistsValue === true || tableExistsValue === 't';

    if (!tableExists) {
      console.warn('[repair-failed-migration] _prisma_migrations table not found, skipping.');
      return;
    }

    for (const migrationName of migrationsToRepair) {
      const pending = await prisma.$queryRaw(
        Prisma.sql`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE "migration_name" = ${migrationName} AND "finished_at" IS NULL`
      );

      const failedCount = Number(Array.isArray(pending) && pending[0] ? pending[0].count : 0);

      if (!failedCount) {
        continue;
      }

      await prisma.$executeRaw(
        Prisma.sql`UPDATE "_prisma_migrations"
          SET "rolled_back_at" = COALESCE("rolled_back_at", NOW()),
              "finished_at" = NOW(),
              "applied_steps_count" = 0,
              "logs" = COALESCE("logs", '') || '\nMarked as rolled back automatically by repair script.'
          WHERE "migration_name" = ${migrationName} AND "finished_at" IS NULL`
      );

      console.log(`[repair-failed-migration] Marked ${failedCount} failed migration instance(s) for ${migrationName} as rolled back.`);
    }

    console.log('[repair-failed-migration] Repair step completed.');
  } catch (error) {
    console.error('[repair-failed-migration] Failed to repair migrations:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
