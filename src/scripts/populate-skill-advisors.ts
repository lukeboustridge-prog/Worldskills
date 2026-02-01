import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

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

  // First, nullify all skill assignments to avoid foreign key constraints
  console.log('Clearing skill assignments...');
  await prisma.skill.updateMany({
    data: {
      scmId: null,
      saId: null
    }
  });
  console.log('✓ Skill assignments cleared\n');

  // Delete existing non-admin users
  console.log('Clearing existing users (except admins)...');
  await prisma.user.deleteMany({
    where: { isAdmin: false }
  });
  console.log('✓ Existing users cleared\n');

  // Create Skill Advisors and assign skills
  for (const advisor of SKILL_ADVISORS) {
    console.log(`Creating: ${advisor.name} (${advisor.email})`);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: advisor.name,
        email: advisor.email,
        role: Role.SA,
        isAdmin: advisor.email === 'luke.boustridge@worldskills.org' // Luke is also admin
      }
    });

    // Find skills by their number in the catalog
    const skills = await prisma.skill.findMany({
      where: {
        id: {
          in: advisor.skillNumbers
        }
      }
    });

    if (skills.length !== advisor.skillNumbers.length) {
      console.log(`  ⚠ Warning: Found ${skills.length} skills, expected ${advisor.skillNumbers.length}`);
      const foundIds = skills.map(s => s.id);
      const missing = advisor.skillNumbers.filter(n => !foundIds.includes(n));
      if (missing.length > 0) {
        console.log(`  Missing skill IDs: ${missing.join(', ')}`);
      }
    }

    // Assign skills to this advisor
    await prisma.skill.updateMany({
      where: {
        id: {
          in: skills.map(s => s.id)
        }
      },
      data: {
        saId: user.id
      }
    });

    console.log(`  ✓ Created and assigned ${skills.length} skills`);
    skills.forEach(skill => {
      console.log(`    - ${skill.id.toString().padStart(2, '0')} ${skill.name}`);
    });
    console.log('');
  }

  // Summary
  const totalUsers = await prisma.user.count({ where: { role: Role.SA } });
  const skillsWithAdvisors = await prisma.skill.count({ where: { saId: { not: null } } });
  const totalSkills = await prisma.skill.count();

  console.log('=== SUMMARY ===');
  console.log(`Skill Advisors created: ${totalUsers}`);
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
