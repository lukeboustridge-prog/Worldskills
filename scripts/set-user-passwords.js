const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setPasswords() {
  const tempPassword = 'TempPass123!';
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Get all users without passwords
  const usersWithoutPasswords = await prisma.user.findMany({
    where: {
      passwordHash: null
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  });

  console.log(`\nFound ${usersWithoutPasswords.length} users without passwords\n`);

  if (usersWithoutPasswords.length === 0) {
    console.log('All users already have passwords!');
    await prisma.$disconnect();
    return;
  }

  console.log('Setting temporary password for these users:');
  for (const user of usersWithoutPasswords) {
    console.log(`  - ${user.name} (${user.email})`);
  }

  console.log(`\nTemporary password: ${tempPassword}\n`);
  console.log('IMPORTANT: Users should change this password after first login!\n');

  // Update all users
  await prisma.user.updateMany({
    where: {
      passwordHash: null
    },
    data: {
      passwordHash
    }
  });

  console.log('✓ Passwords set successfully!\n');
  console.log('Users can now log in with:');
  console.log(`  Password: ${tempPassword}`);
  console.log('\nThey should change it immediately after logging in.\n');

  await prisma.$disconnect();
}

setPasswords().catch(console.error);
