import { DeliverableScheduleType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { SKILL_CATALOG } from "../src/lib/skill-catalog";
import { DEFAULT_DELIVERABLE_TEMPLATES, buildCMonthLabel, computeDueDate } from "../src/lib/deliverables";

const prisma = new PrismaClient();
const defaultHostEmail = "luke.boustridge@gmail.com";
const defaultHostName = "Luke Boustridge";
const defaultSAPassword = "Tomatoes"; // Default password for all Skill Advisors

// Real Skill Advisors from WSC2026 Competition Preparation Summary
const SKILL_ADVISORS = [
  {
    name: 'Arwid Wibom',
    email: 'arwid.wibom@worldskills.org',
    skillNumbers: [12, 18, 19, 38, 48, 58]
  },
  {
    name: 'Vesa Iltola',
    email: 'vesa.iltola@worldskills.org',
    skillNumbers: [23, 34, 35, 47, 52, 64]
  },
  {
    name: 'Naomi Zadow',
    email: 'naomi.zadow@worldskills.org',
    skillNumbers: [24, 25, 26, 30, 41, 43, 56]
  },
  {
    name: 'Sue Collins',
    email: 'sue.collins@worldskills.org',
    skillNumbers: [4, 14, 33, 55, 61, 62]
  },
  {
    name: 'Raili Laas',
    email: 'raili.laas@worldskills.org',
    skillNumbers: [15, 20, 21, 22, 37, 46]
  },
  {
    name: 'Luke Boustridge',
    email: 'luke.boustridge@worldskills.org',
    skillNumbers: [1, 3, 5, 10, 16, 59, 60]
  },
  {
    name: 'Sue Lefort',
    email: 'sue.lefort@worldskills.org',
    skillNumbers: [6, 7, 13, 36, 49, 57]
  },
  {
    name: 'Jeff Boulton',
    email: 'jeff.boulton@worldskills.org',
    skillNumbers: [11, 32, 44, 50, 53, 54]
  },
  {
    name: 'David Summerville',
    email: 'david.summerville@worldskills.org',
    skillNumbers: [2, 8, 9, 17, 39, 51, 63]
  },
  {
    name: 'Tapio Kattainen',
    email: 'tapio.kattainen@worldskills.org',
    skillNumbers: [27, 28, 29, 31, 40, 42, 45]
  }
];

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

  // Hash default SA password
  const saPasswordHash = await bcrypt.hash(defaultSAPassword, 12);

  let hostUser = await prisma.user.findUnique({
    where: { email: normalizedHostEmail }
  });

  if (hostUser) {
    const needsPassword = !hostUser.passwordHash;
    hostUser = await prisma.user.update({
      where: { id: hostUser.id },
      data: {
        role: Role.SA,
        isAdmin: true,
        name: hostDisplayName,
        ...(needsPassword ? { passwordHash: hostPasswordHash } : {})
      }
    });
  } else {
    hostUser = await prisma.user.create({
      data: {
        email: normalizedHostEmail,
        name: hostDisplayName,
        role: Role.SA,
        isAdmin: true,
        passwordHash: hostPasswordHash
      }
    });
  }

  // Note: SCM users are not seeded - they should be created manually as needed

  // Create/update Skill Advisors with real data from WSC2026
  const advisorMap = new Map<string, { id: string; skillNumbers: number[] }>();

  for (const advisor of SKILL_ADVISORS) {
    const normalizedEmail = advisor.email.toLowerCase();
    const isHostSA = normalizedEmail === normalizedHostEmail;

    // Skip if this is the host user (already created above)
    if (isHostSA) {
      advisorMap.set(hostUser.id, { id: hostUser.id, skillNumbers: advisor.skillNumbers });
      continue;
    }

    const existingAdvisor = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingAdvisor) {
      const needsPassword = !existingAdvisor.passwordHash;
      if (existingAdvisor.name !== advisor.name || existingAdvisor.role !== Role.SA || needsPassword) {
        await prisma.user.update({
          where: { id: existingAdvisor.id },
          data: {
            name: advisor.name,
            role: Role.SA,
            ...(needsPassword ? { passwordHash: saPasswordHash } : {})
          }
        });
      }
      advisorMap.set(existingAdvisor.id, { id: existingAdvisor.id, skillNumbers: advisor.skillNumbers });
    } else {
      const newAdvisor = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: advisor.name,
          role: Role.SA,
          passwordHash: saPasswordHash
        }
      });
      advisorMap.set(newAdvisor.id, { id: newAdvisor.id, skillNumbers: advisor.skillNumbers });
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

  // Find which Skill Advisor should be assigned to each skill
  const skillToAdvisor = new Map<number, string>();
  for (const [advisorId, advisor] of advisorMap.entries()) {
    for (const skillNum of advisor.skillNumbers) {
      skillToAdvisor.set(skillNum, advisorId);
    }
  }

  for (const skill of skillSeeds) {
    // Determine which SA should be assigned to this skill
    const assignedSAId = skillToAdvisor.get(Number(skill.code)) ?? hostUser.id;

    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {
        name: skill.name,
        sector: skill.sector,
        notes: `Skill Code ${skill.code} — ${skill.sector}`,
        saId: assignedSAId,
        scmId: null // SCMs assigned manually as needed
      },
      create: {
        id: skill.id,
        name: skill.name,
        sector: skill.sector,
        notes: `Skill Code ${skill.code} — ${skill.sector}`,
        saId: assignedSAId,
        scmId: null // SCMs assigned manually as needed
      }
    });
  }

  const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 } });

  if (!appSettings) {
    throw new Error("App settings failed to initialize during seeding.");
  }

  await Promise.all(
    DEFAULT_DELIVERABLE_TEMPLATES.map((template) =>
      prisma.deliverableTemplate.upsert({
        where: { key: template.key },
        update: {
          label: template.label,
          offsetMonths: template.offsetMonths,
          position: template.position
        },
        create: {
          key: template.key,
          label: template.label,
          offsetMonths: template.offsetMonths,
          position: template.position
        }
      })
    )
  );

  const seededSkills = await prisma.skill.findMany({ select: { id: true } });
  for (const skill of seededSkills) {
    for (const definition of DEFAULT_DELIVERABLE_TEMPLATES) {
      const usingCMonth = definition.scheduleType === DeliverableScheduleType.CMonth;
      const offset = definition.offsetMonths;
      const dueDate = usingCMonth
        ? offset == null
          ? null
          : computeDueDate(appSettings.competitionStart, offset)
        : definition.calendarDueDate ?? null;

      if (!dueDate) {
        console.warn(
          `Skipping deliverable ${definition.key} during seed because it is missing a due date.`
        );
        continue;
      }

      await prisma.deliverable.upsert({
        where: {
          skillId_key: {
            skillId: skill.id,
            key: definition.key
          }
        },
        update: {
          label: definition.label,
          scheduleType: definition.scheduleType,
          cMonthOffset: usingCMonth ? offset ?? null : null,
          cMonthLabel:
            usingCMonth && offset != null ? buildCMonthLabel(offset) : null,
          dueDate
        },
        create: {
          skillId: skill.id,
          key: definition.key,
          label: definition.label,
          scheduleType: definition.scheduleType,
          cMonthOffset: usingCMonth ? offset ?? null : null,
          cMonthLabel:
            usingCMonth && offset != null ? buildCMonthLabel(offset) : null,
          dueDate
        }
      });
    }
  }

  console.log(
    `Seed data created. Host admin login: ${hostEmailEnv} (password: ${hostPassword}). Seeded ${skillSeeds.length} skills for WSC 2026 with ${SKILL_ADVISORS.length} Skill Advisors (password: ${defaultSAPassword}).`
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
