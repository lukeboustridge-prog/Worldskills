const { PrismaClient, Role } = require('@prisma/client');
const prisma = new PrismaClient();

// Skill Advisor data from WSC2026 Competition Preparation Summary
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

async function populateSkillAdvisors() {
  console.log('=== Populating Skill Advisors from WSC2026 Data ===\n');

  // Get list of current SA users to delete later
  const currentSAs = await prisma.user.findMany({
    where: { role: Role.SA }
  });
  console.log(`Found ${currentSAs.length} existing Skill Advisors\n`);

  // Create/update Skill Advisors and assign skills
  for (const advisor of SKILL_ADVISORS) {
    console.log(`Creating/updating: ${advisor.name} (${advisor.email})`);

    // Upsert user (create or update)
    const user = await prisma.user.upsert({
      where: { email: advisor.email },
      update: {
        name: advisor.name,
        role: Role.SA,
        isAdmin: advisor.email === 'luke.boustridge@worldskills.org'
      },
      create: {
        name: advisor.name,
        email: advisor.email,
        role: Role.SA,
        isAdmin: advisor.email === 'luke.boustridge@worldskills.org'
      }
    });

    // Convert skill numbers to skill IDs (assuming skill IDs match the skill numbers)
    // The skill IDs in the database follow the format "skill-{number}-{name}"
    // We need to find skills by their numeric ID or by querying
    const skills = await prisma.skill.findMany({
      where: {
        id: {
          in: advisor.skillNumbers.map(n => `skill-${String(n).padStart(2, '0')}`)
        }
      }
    });

    // If we didn't find all skills by ID prefix, try a different approach
    if (skills.length === 0) {
      console.log(`  ℹ Trying alternative skill lookup...`);
      // Get all skills and filter by extracting number from ID
      const allSkills = await prisma.skill.findMany();
      const matchedSkills = allSkills.filter(skill => {
        const match = skill.id.match(/skill-(\d+)-/);
        if (match) {
          const skillNum = parseInt(match[1], 10);
          return advisor.skillNumbers.includes(skillNum);
        }
        return false;
      });

      if (matchedSkills.length > 0) {
        skills.push(...matchedSkills);
      }
    }

    if (skills.length !== advisor.skillNumbers.length) {
      console.log(`  ⚠ Warning: Found ${skills.length} skills, expected ${advisor.skillNumbers.length}`);
      const foundIds = skills.map(s => s.id);
      const missing = advisor.skillNumbers.filter(n => !foundIds.some(id => id.includes(`-${String(n).padStart(2, '0')}-`)));
      if (missing.length > 0) {
        console.log(`  Missing skill numbers: ${missing.join(', ')}`);
      }
    }

    // Assign skills to this advisor using raw SQL to avoid Prisma client issues
    if (skills.length > 0) {
      for (const skill of skills) {
        await prisma.$executeRaw`UPDATE "Skill" SET "saId" = ${user.id} WHERE "id" = ${skill.id}`;
      }
      console.log(`  ✓ Created and assigned ${skills.length} skills`);
      skills.forEach(skill => {
        console.log(`    - ${skill.id} ${skill.name}`);
      });
    }
    console.log('');
  }

  // Delete old SA users that are not in the new list
  const newEmails = SKILL_ADVISORS.map(a => a.email);
  const toDelete = currentSAs.filter(sa => !newEmails.includes(sa.email));

  if (toDelete.length > 0) {
    console.log(`\nRemoving ${toDelete.length} old Skill Advisors...`);
    for (const sa of toDelete) {
      // First, reassign their skills to null or a default user
      // Since saId is NOT NULL, we need to assign to someone else
      // For now, skip deletion if they have skills assigned
      const skillCount = await prisma.skill.count({ where: { saId: sa.id } });
      if (skillCount > 0) {
        console.log(`  ⚠ Cannot delete ${sa.email} - has ${skillCount} skills still assigned`);
      } else {
        await prisma.user.delete({ where: { id: sa.id } });
        console.log(`  ✓ Deleted ${sa.email}`);
      }
    }
  }

  // Summary
  const totalUsers = await prisma.user.count({ where: { role: Role.SA } });
  const skillsWithAdvisors = await prisma.skill.count({ where: { saId: { not: null } } });
  const totalSkills = await prisma.skill.count();

  console.log('\n=== SUMMARY ===');
  console.log(`Skill Advisors: ${totalUsers}`);
  console.log(`Skills with advisors: ${skillsWithAdvisors}/${totalSkills}`);
  console.log('\n✓ Skill Advisors populated successfully');
}

populateSkillAdvisors()
  .catch(error => {
    console.error('Error populating Skill Advisors:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
