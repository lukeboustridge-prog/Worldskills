import { PrismaClient, QualityIndicator } from "@prisma/client";
import fs from "fs/promises";

const prisma = new PrismaClient();

interface TemplateDescriptor {
  code: string;
  criterionName: string;
  category: string;
  sector: string;
  score0: string;
  score1: string;
  score2: string;
  score3: string;
  tags: string[];
}

async function importTemplates() {
  console.log("=== Importing Final Template Descriptors ===\n");

  // Load templates from JSON
  const templatesJson = await fs.readFile("final-templates.json", "utf-8");
  const templates: TemplateDescriptor[] = JSON.parse(templatesJson);
  console.log(`Loaded ${templates.length} templates from final-templates.json`);

  // Clear existing descriptors
  console.log("\n--- Clearing existing descriptors ---");
  const deleted = await prisma.descriptor.deleteMany({
    where: { source: { in: ["WSC2024", "Template"] } }
  });
  console.log(`Deleted ${deleted.count} existing descriptors`);

  // Import new templates
  console.log("\n--- Importing templates ---");
  let imported = 0;
  let failed = 0;

  for (const t of templates) {
    try {
      await prisma.$executeRaw`
        INSERT INTO "Descriptor" (
          id, code, "criterionName", category, sector,
          score0, score1, score2, score3,
          source, "skillName", tags, version,
          "qualityIndicator", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text,
          ${t.code},
          ${t.criterionName},
          ${t.category},
          ${t.sector},
          ${t.score0},
          ${t.score1},
          ${t.score2},
          ${t.score3},
          'Template',
          ${t.sector},
          ${t.tags}::text[],
          1,
          'NEEDS_REVIEW'::"QualityIndicator",
          NOW(),
          NOW()
        )
      `;
      imported++;
    } catch (error) {
      console.error(`Failed to import ${t.code}: ${error}`);
      failed++;
    }
  }

  console.log(`\nImported: ${imported}`);
  console.log(`Failed: ${failed}`);

  // Verify final count
  const finalCount = await prisma.descriptor.count({
    where: { deletedAt: null }
  });

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Total descriptors in database: ${finalCount}`);

  // Show category breakdown
  const byCategory = await prisma.$queryRaw<{category: string, count: bigint}[]>`
    SELECT category, COUNT(*) as count
    FROM "Descriptor"
    WHERE "deletedAt" IS NULL
    GROUP BY category
    ORDER BY count DESC
  `;

  console.log("\nBy category:");
  for (const row of byCategory) {
    console.log(`  ${row.category}: ${row.count}`);
  }
}

importTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
