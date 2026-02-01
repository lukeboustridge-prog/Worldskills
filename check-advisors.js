const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdvisors() {
  const advisors = await prisma.user.findMany({
    where: { role: 'SA' },
    select: {
      name: true,
      email: true,
      _count: {
        select: {
          skillsAsSA: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log('=== SKILL ADVISORS ===\n');
  advisors.forEach(advisor => {
    console.log(`${advisor.name.padEnd(25)} | ${advisor.email.padEnd(45)} | ${advisor._count.skillsAsSA} skills`);
  });
  console.log(`\nTotal: ${advisors.length} Skill Advisors`);

  await prisma.$disconnect();
}

checkAdvisors();
