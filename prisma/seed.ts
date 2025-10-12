import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  const hostPassword = process.env.HOST_INITIAL_PASSWORD ?? "ChangeMe123!";
  const hostPasswordHash = await bcrypt.hash(hostPassword, 12);

  let hostUser = await prisma.user.findUnique({
    where: { email: normalizedHostEmail }
  });

  if (hostUser) {
    const needsPassword = !hostUser.passwordHash;
    hostUser = await prisma.user.update({
      where: { id: hostUser.id },
      data: {
        role: Role.SA,
        ...(needsPassword ? { passwordHash: hostPasswordHash } : {})
      }
    });
  } else {
    hostUser = await prisma.user.create({
      data: {
        email: normalizedHostEmail,
        name: "WorldSkills Host",
        role: Role.SA,
        passwordHash: hostPasswordHash
      }
    });
  }

  const scmPassword = "SamplePassword123!";
  const scmPasswordHash = await bcrypt.hash(scmPassword, 12);

  let scm = await prisma.user.findUnique({ where: { email: "scm@example.com" } });
  if (scm) {
    const needsPassword = !scm.passwordHash;
    if (needsPassword || scm.role !== Role.SCM) {
      scm = await prisma.user.update({
        where: { id: scm.id },
        data: {
          role: Role.SCM,
          ...(needsPassword ? { passwordHash: scmPasswordHash } : {})
        }
      });
    }
  } else {
    scm = await prisma.user.create({
      data: {
        email: "scm@example.com",
        name: "Sample SCM",
        role: Role.SCM,
        passwordHash: scmPasswordHash
      }
    });
  }

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
    `Seed data created. Host SA login: ${hostEmailEnv} (password: ${hostPassword}), SCM login: scm@example.com (password: ${scmPassword})`
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
