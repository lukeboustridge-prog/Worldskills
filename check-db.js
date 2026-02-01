const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const userCount = await prisma.user.count();
    const descriptorCount = await prisma.descriptor.count();

    console.log('=== DATABASE STATUS ===');
    console.log('Users:', userCount);
    console.log('Descriptors:', descriptorCount);

    if (userCount > 0) {
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true },
        take: 5
      });
      console.log('\nSample users:');
      users.forEach(u => console.log(`  - ${u.email} (${u.role})`));
    } else {
      console.log('\n⚠️  WARNING: No users found!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
