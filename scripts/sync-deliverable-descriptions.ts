/**
 * Sync deliverable descriptions from DEFAULT_DELIVERABLE_TEMPLATES
 *
 * This script:
 * 1. Updates DeliverableTemplate records with descriptions from code
 * 2. Updates all Deliverable records with descriptions from their templates
 *
 * Usage: npx tsx scripts/sync-deliverable-descriptions.ts
 */

import { PrismaClient } from "@prisma/client";
import { DEFAULT_DELIVERABLE_TEMPLATES } from "../src/lib/deliverables";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Step 1: Update DeliverableTemplate records ===\n");

  // Create a map of descriptions from the code
  const templateDescriptions = new Map(
    DEFAULT_DELIVERABLE_TEMPLATES.map((t) => [t.key, t.description])
  );

  console.log(`Found ${DEFAULT_DELIVERABLE_TEMPLATES.length} template definitions in code`);

  // Update each template in the database
  let templatesUpdated = 0;
  for (const [key, description] of templateDescriptions) {
    if (description) {
      const result = await prisma.deliverableTemplate.updateMany({
        where: { key },
        data: { description }
      });
      if (result.count > 0) {
        templatesUpdated++;
        console.log(`Updated template: ${key}`);
      }
    }
  }

  console.log(`\nUpdated ${templatesUpdated} templates\n`);

  console.log("=== Step 2: Sync descriptions to Deliverable records ===\n");

  // Batch update deliverables by templateKey
  let totalUpdated = 0;
  for (const [key, description] of templateDescriptions) {
    if (description) {
      const result = await prisma.deliverable.updateMany({
        where: {
          templateKey: key,
          OR: [
            { description: null },
            { description: "" }
          ]
        },
        data: { description }
      });
      if (result.count > 0) {
        console.log(`Updated ${result.count} deliverables for template: ${key}`);
        totalUpdated += result.count;
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Templates updated: ${templatesUpdated}`);
  console.log(`Deliverables updated: ${totalUpdated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
