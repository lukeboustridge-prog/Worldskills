const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setSAPasswords() {
  console.log('=== Setting SA Passwords ===\n');

  const password = 'Tomatoes';
  console.log(`Hashing password...`);
  const passwordHash = await bcrypt.hash(password, 12);
  console.log('✓ Password hashed\n');

  // Get all SA users
  const saUsers = await prisma.user.findMany({
    where: { role: 'SA' },
    select: { id: true, name: true, email: true }
  });

  console.log(`Found ${saUsers.length} Skill Advisors\n`);

  // Update all SA passwords
  console.log('Updating passwords...');
  await prisma.user.updateMany({
    where: { role: 'SA' },
    data: { passwordHash }
  });

  console.log('\n=== COMPLETE ===');
  console.log(`Updated ${saUsers.length} Skill Advisor passwords to: ${password}`);
  console.log('\nSkill Advisors:');
  saUsers.forEach(sa => {
    console.log(`  - ${sa.name.padEnd(25)} ${sa.email}`);
  });
}

setSAPasswords()
  .catch(error => {
    console.error('Error setting SA passwords:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
