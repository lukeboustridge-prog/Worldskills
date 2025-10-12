import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const defaultHostEmail = "luke.boustridge@gmail.com";

async function main() {
  const hostEmailEnv = process.env.HOST_EMAIL ?? defaultHostEmail;
  const normalizedHostEmail = hostEmailEnv.toLowerCase();
  if (hostEmailEnv !== normalizedHostEmail) {
    await prisma.user.updateMany({
      where: { email: hostEmailEnv },
      data: { email: normalizedHostEmail }
    });
  }
  const hostUser = await prisma.user.upsert({
    where: { email: normalizedHostEmail },
    update: {
      role: Role.SA
    },
    create: {
      email: normalizedHostEmail,
      name: "WorldSkills Host",
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
      saId: hostUser.id,
      scmId: scm.id
    }
  });

  console.log(
    `Seed data created. Host SA login: ${hostEmailEnv}, SCM login: scm@example.com`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
