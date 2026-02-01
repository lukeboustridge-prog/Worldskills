const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function vacuumAnalyze() {
  console.log('Running VACUUM ANALYZE on Descriptor table...\n');

  await prisma.$executeRawUnsafe('VACUUM ANALYZE "Descriptor";');

  console.log('✓ VACUUM ANALYZE complete\n');
  console.log('This updates table statistics to help PostgreSQL choose optimal query plans.');

  await prisma.$disconnect();
}

vacuumAnalyze();
