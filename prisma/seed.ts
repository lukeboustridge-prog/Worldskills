import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { SKILL_CATALOG } from "../src/lib/skill-catalog";
import { STANDARD_DELIVERABLES, buildCMonthLabel, computeDueDate } from "../src/lib/deliverables";

const prisma = new PrismaClient();
const defaultHostEmail = "luke.boustridge@gmail.com";
const defaultHostName = "Luke Boustridge";
const advisorNames = [
  "Dave Summerville",
  "Luke Boustridge",
  "Sue Collins",
  "Sue Lefort",
  "Vesa Iltola",
  "Steve Brooks",
  "Jeff Boulton",
  "Arwid Wibom"
];

const advisorEmailDomain = "worldskills-sa.test";

function slugifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

async function main() {
  const hostEmailEnv = process.env.HOST_EMAIL ?? defaultHostEmail;
  const normalizedHostEmail = hostEmailEnv.toLowerCase();
  if (hostEmailEnv !== normalizedHostEmail) {
    await prisma.user.updateMany({
      where: { email: hostEmailEnv },
      data: { email: normalizedHostEmail }
    });
  }
  const hostNameEnv = process.env.HOST_NAME?.trim();
  const hostDisplayName =
    hostNameEnv && hostNameEnv.length > 0
      ? hostNameEnv
      : normalizedHostEmail === defaultHostEmail
        ? defaultHostName
        : "WorldSkills Host";
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
        role: Role.Admin,
        name: hostDisplayName,
        ...(needsPassword ? { passwordHash: hostPasswordHash } : {})
      }
    });
  } else {
    hostUser = await prisma.user.create({
      data: {
        email: normalizedHostEmail,
        name: hostDisplayName,
        role: Role.Admin,
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

  const advisorSeeds = advisorNames
    .map((name) => ({
      name,
      email: `${slugifyName(name)}@${advisorEmailDomain}`
    }))
    .filter((advisor) => advisor.name.toLowerCase() !== hostDisplayName.toLowerCase());

  for (const advisor of advisorSeeds) {
    const normalizedEmail = advisor.email.toLowerCase();
    const existingAdvisor = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingAdvisor) {
      if (existingAdvisor.name !== advisor.name || existingAdvisor.role !== Role.SA) {
        await prisma.user.update({
          where: { id: existingAdvisor.id },
          data: {
            name: advisor.name,
            role: Role.SA
          }
        });
      }
    } else {
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: advisor.name,
          role: Role.SA
        }
      });
    }
  }

  const competitionStart = new Date(process.env.SEED_COMPETITION_START ?? "2026-09-01");
  const competitionEnd = new Date(process.env.SEED_COMPETITION_END ?? "2026-09-10");

  await prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      competitionName: "WorldSkills Competition 2026",
      competitionStart,
      competitionEnd,
      keyDates: {}
    },
    update: {
      competitionName: "WorldSkills Competition 2026",
      competitionStart,
      competitionEnd
    }
  });

  const skillSeeds = SKILL_CATALOG;

  for (const skill of skillSeeds) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {
        name: skill.name,
        sector: skill.sector,
        notes: `Skill Code ${skill.code} — ${skill.sector}`,
        saId: hostUser.id,
        scmId: scm.id
      },
      create: {
        id: skill.id,
        name: skill.name,
        sector: skill.sector,
        notes: `Skill Code ${skill.code} — ${skill.sector}`,
        saId: hostUser.id,
        scmId: scm.id
      }
    });
  }

  const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 } });

  if (!appSettings) {
    throw new Error("App settings failed to initialize during seeding.");
  }

  const seededSkills = await prisma.skill.findMany({ select: { id: true } });
  for (const skill of seededSkills) {
    for (const definition of STANDARD_DELIVERABLES) {
      await prisma.deliverable.upsert({
        where: {
          skillId_key: {
            skillId: skill.id,
            key: definition.key
          }
        },
        update: {
          label: definition.label,
          cMonthOffset: definition.offsetMonths,
          cMonthLabel: buildCMonthLabel(definition.offsetMonths),
          dueDate: computeDueDate(appSettings.competitionStart, definition.offsetMonths)
        },
        create: {
          skillId: skill.id,
          key: definition.key,
          label: definition.label,
          cMonthOffset: definition.offsetMonths,
          cMonthLabel: buildCMonthLabel(definition.offsetMonths),
          dueDate: computeDueDate(appSettings.competitionStart, definition.offsetMonths)
        }
      });
    }
  }

  console.log(
    `Seed data created. Host admin login: ${hostEmailEnv} (password: ${hostPassword}), SCM login: scm@example.com (password: ${scmPassword}). Seeded ${skillSeeds.length} skills for WSC 2026.`
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
