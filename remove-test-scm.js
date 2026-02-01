const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeTestSCM() {
  console.log('=== Removing Test SCM User ===\n');

  // Find the test SCM user
  const scmUser = await prisma.user.findUnique({
    where: { email: 'scm@example.com' }
  });

  if (!scmUser) {
    console.log('✓ Test SCM user not found - already removed or never existed');
    return;
  }

  console.log(`Found test SCM: ${scmUser.name} (${scmUser.email})`);

  // Check how many skills are linked to this SCM
  const skillCount = await prisma.skill.count({
    where: { scmId: scmUser.id }
  });

  console.log(`  - Linked to ${skillCount} skills\n`);

  if (skillCount > 0) {
    console.log('Unlinking skills from test SCM...');
    await prisma.skill.updateMany({
      where: { scmId: scmUser.id },
      data: { scmId: null }
    });
    console.log(`✓ Unlinked ${skillCount} skills\n`);
  }

  // Delete the SCM user
  console.log('Deleting test SCM user...');
  await prisma.user.delete({
    where: { id: scmUser.id }
  });
  console.log('✓ Test SCM user deleted\n');

  console.log('=== COMPLETE ===');
  console.log('Test SCM user removed successfully');
}

removeTestSCM()
  .catch(error => {
    console.error('Error removing test SCM:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
