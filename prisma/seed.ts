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

  const skillSeeds = [
    {
      id: "skill-01-industrial-mechanics",
      code: "01",
      name: "Industrial Mechanics",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-02-ict-network-infrastructure",
      code: "02",
      name: "ICT Network Infrastructure",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-03-intelligent-security-technology",
      code: "03",
      name: "Intelligent Security Technology",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-04-mechatronics",
      code: "04",
      name: "Mechatronics",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-05-mechanical-engineering-cad",
      code: "05",
      name: "Mechanical Engineering CAD",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-06-cnc-turning",
      code: "06",
      name: "CNC Turning",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-07-cnc-milling",
      code: "07",
      name: "CNC Milling",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-08-mobile-applications-development",
      code: "08",
      name: "Mobile Applications Development",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-09-software-applications-development",
      code: "09",
      name: "Software Applications Development",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-10-welding",
      code: "10",
      name: "Welding",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-11-software-testing",
      code: "11",
      name: "Software Testing",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-12-wall-and-floor-tiling",
      code: "12",
      name: "Wall and Floor Tiling",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-13-autobody-repair",
      code: "13",
      name: "Autobody Repair",
      sector: "Transportation and Logistics"
    },
    {
      id: "skill-14-aircraft-maintenance",
      code: "14",
      name: "Aircraft Maintenance",
      sector: "Transportation and Logistics"
    },
    {
      id: "skill-15-plumbing-and-heating",
      code: "15",
      name: "Plumbing and Heating",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-16-electronics",
      code: "16",
      name: "Electronics",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-17-web-technologies",
      code: "17",
      name: "Web Technologies",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-18-electrical-installations",
      code: "18",
      name: "Electrical Installations",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-19-industrial-control",
      code: "19",
      name: "Industrial Control",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-20-bricklaying",
      code: "20",
      name: "Bricklaying",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-21-plastering-and-drywall-systems",
      code: "21",
      name: "Plastering and Drywall Systems",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-22-painting-and-decorating",
      code: "22",
      name: "Painting and Decorating",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-23-autonomous-mobile-robotics",
      code: "23",
      name: "Autonomous Mobile Robotics",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-24-cabinetmaking",
      code: "24",
      name: "Cabinetmaking",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-25-joinery",
      code: "25",
      name: "Joinery",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-26-carpentry",
      code: "26",
      name: "Carpentry",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-27-jewellery",
      code: "27",
      name: "Jewellery",
      sector: "Creative Arts and Fashion"
    },
    {
      id: "skill-28-floristry",
      code: "28",
      name: "Floristry",
      sector: "Creative Arts and Fashion"
    },
    {
      id: "skill-29-hairdressing",
      code: "29",
      name: "Hairdressing",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-30-beauty-therapy",
      code: "30",
      name: "Beauty Therapy",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-31-fashion-technology",
      code: "31",
      name: "Fashion Technology",
      sector: "Creative Arts and Fashion"
    },
    {
      id: "skill-32-patisserie-and-confectionery",
      code: "32",
      name: "Pâtisserie and Confectionery",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-33-automobile-technology",
      code: "33",
      name: "Automobile Technology",
      sector: "Transportation and Logistics"
    },
    {
      id: "skill-34-cooking",
      code: "34",
      name: "Cooking",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-35-restaurant-service",
      code: "35",
      name: "Restaurant Service",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-36-car-painting",
      code: "36",
      name: "Car Painting",
      sector: "Transportation and Logistics"
    },
    {
      id: "skill-37-landscape-gardening",
      code: "37",
      name: "Landscape Gardening",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-38-refrigeration-and-air-conditioning",
      code: "38",
      name: "Refrigeration and Air Conditioning",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-39-it-network-systems-administration",
      code: "39",
      name: "IT Network Systems Administration",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-40-graphic-design-technology",
      code: "40",
      name: "Graphic Design Technology",
      sector: "Creative Arts and Fashion"
    },
    {
      id: "skill-41-health-and-social-care",
      code: "41",
      name: "Health and Social Care",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-42-dental-prosthetics",
      code: "42",
      name: "Dental Prosthetics",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-43-retail-sales",
      code: "43",
      name: "Retail Sales",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-44-visual-merchandising",
      code: "44",
      name: "Visual Merchandising",
      sector: "Creative Arts and Fashion"
    },
    {
      id: "skill-45-digital-interactive-media-design",
      code: "45",
      name: "Digital Interactive Media Design",
      sector: "Creative Arts and Fashion"
    },
    {
      id: "skill-46-concrete-construction-work",
      code: "46",
      name: "Concrete Construction Work",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-47-bakery",
      code: "47",
      name: "Bakery",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-48-industry-4-0",
      code: "48",
      name: "Industry 4.0",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-49-heavy-vehicle-technology",
      code: "49",
      name: "Heavy Vehicle Technology",
      sector: "Transportation and Logistics"
    },
    {
      id: "skill-50-3d-digital-game-art",
      code: "50",
      name: "3D Digital Game Art",
      sector: "Creative Arts and Fashion"
    },
    {
      id: "skill-51-logistics-and-freight-forwarding",
      code: "51",
      name: "Logistics and Freight Forwarding",
      sector: "Transportation and Logistics"
    },
    {
      id: "skill-52-chemical-laboratory-technology",
      code: "52",
      name: "Chemical Laboratory Technology",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-53-cloud-computing",
      code: "53",
      name: "Cloud Computing",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-54-cyber-security",
      code: "54",
      name: "Cyber Security",
      sector: "Information and Communication Technology"
    },
    {
      id: "skill-55-water-technology",
      code: "55",
      name: "Water Technology",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-56-hotel-reception",
      code: "56",
      name: "Hotel Reception",
      sector: "Social and Personal Services"
    },
    {
      id: "skill-57-additive-manufacturing",
      code: "57",
      name: "Additive Manufacturing",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-58-digital-construction",
      code: "58",
      name: "Digital Construction",
      sector: "Construction and Building Technology"
    },
    {
      id: "skill-59-industrial-design-technology",
      code: "59",
      name: "Industrial Design Technology",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-60-optoelectronic-technology",
      code: "60",
      name: "Optoelectronic Technology",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-61-rail-vehicle-technology",
      code: "61",
      name: "Rail Vehicle Technology",
      sector: "Transportation and Logistics"
    },
    {
      id: "skill-62-renewable-energy",
      code: "62",
      name: "Renewable Energy",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-63-robot-systems-integration",
      code: "63",
      name: "Robot Systems Integration",
      sector: "Manufacturing and Engineering Technology"
    },
    {
      id: "skill-64-unmanned-aerial-systems",
      code: "64",
      name: "Unmanned Aerial Systems",
      sector: "Transportation and Logistics"
    }
  ];

  for (const skill of skillSeeds) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {
        name: skill.name,
        notes: `Skill Code ${skill.code} — ${skill.sector}`,
        saId: hostUser.id,
        scmId: scm.id
      },
      create: {
        id: skill.id,
        name: skill.name,
        notes: `Skill Code ${skill.code} — ${skill.sector}`,
        saId: hostUser.id,
        scmId: scm.id
      }
    });
  }

  console.log(
    `Seed data created. Host SA login: ${hostEmailEnv} (password: ${hostPassword}), SCM login: scm@example.com (password: ${scmPassword}). Seeded ${skillSeeds.length} skills for WSC 2026.`
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
