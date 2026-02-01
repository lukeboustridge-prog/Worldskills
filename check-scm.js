const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSCM() {
  const scmCount = await prisma.user.count({ where: { role: 'SCM' } });
  const skillsWithSCM = await prisma.skill.count({ where: { scmId: { not: null } } });

  console.log('SCM users:', scmCount);
  console.log('Skills with SCM assigned:', skillsWithSCM);

  await prisma.$disconnect();
}

checkSCM();
