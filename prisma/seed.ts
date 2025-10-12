import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sa = await prisma.user.upsert({
    where: { email: "advisor@example.com" },
    update: {},
    create: {
      email: "advisor@example.com",
      name: "Sample Skill Advisor",
      role: Role.SA
    }
  });

  const scm = await prisma.user.upsert({
    where: { email: "scm@example.com" },
    update: {},
    create: {
      email: "scm@example.com",
      name: "Sample SCM",
      role: Role.SCM
    }
  });

  await prisma.skill.upsert({
    where: { id: "sample-skill" },
    update: {},
    create: {
      id: "sample-skill",
      name: "Sample WorldSkills Skill",
      notes: "This seed skill helps you explore the Skill Advisor Tracker UI.",
      saId: sa.id,
      scmId: scm.id
    }
  });

  console.log("Seed data created. Advisor login: advisor@example.com, SCM login: scm@example.com");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
