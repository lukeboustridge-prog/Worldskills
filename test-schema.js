const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  // Try to query the Skill model to see what fields are available
  const skill = await prisma.skill.findFirst();
  console.log('First skill:', JSON.stringify(skill, null, 2));

  // Check the Prisma client's model definition
  console.log('\nSkill model fields:', Object.keys(prisma.skill.fields || {}));
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
