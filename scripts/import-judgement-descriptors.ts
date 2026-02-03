/**
 * Import Judgement Descriptors from JSON file
 *
 * Usage: npx tsx scripts/import-judgement-descriptors.ts [--dry-run] [--clear-existing]
 *
 * Options:
 *   --dry-run         Validate without inserting
 *   --clear-existing  Delete existing Judgement source descriptors before import
 */

import { PrismaClient, QualityIndicator } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface JsonDescriptor {
  code: string;
  criterionName: string;
  score3: string;
  score2: string;
  score1: string;
  score0: string;
  categories: string[];
  tags: string[];
  skillNames: string[];
  source: string;
  qualityIndicator: string;
  version: number;
}

const SOURCE_TAG = 'Judgement'; // Use distinct source to allow re-import

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const clearExisting = args.includes('--clear-existing');

  // Path to JSON file
  const jsonPath = path.resolve(
    'C:\\Users\\LukeBoustridge\\Projects\\Workinprogress\\Descriptors\\WorldSkills_Judgement_Descriptors_228 (1).json'
  );

  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    process.exit(1);
  }

  console.log('📁 Reading JSON file...');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const descriptors: JsonDescriptor[] = JSON.parse(rawData);

  console.log(`📊 Found ${descriptors.length} descriptors to import`);

  // Validate
  const errors: string[] = [];
  for (let i = 0; i < descriptors.length; i++) {
    const d = descriptors[i];
    if (!d.code) errors.push(`Row ${i + 1}: Missing code`);
    if (!d.criterionName) errors.push(`Row ${i + 1}: Missing criterionName`);
  }

  if (errors.length > 0) {
    console.error('\n❌ Validation errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✅ All descriptors validated');

  // Show category breakdown
  const categoryCounts = new Map<string, number>();
  for (const d of descriptors) {
    for (const cat of d.categories) {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
  }
  console.log('\n📂 Category breakdown:');
  const sortedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCategories.slice(0, 10)) {
    console.log(`   ${cat}: ${count}`);
  }
  if (sortedCategories.length > 10) {
    console.log(`   ... and ${sortedCategories.length - 10} more categories`);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes made');
    await prisma.$disconnect();
    return;
  }

  // Clear existing if requested
  if (clearExisting) {
    console.log(`\n🗑️  Deleting existing '${SOURCE_TAG}' descriptors...`);
    const deleted = await prisma.descriptor.deleteMany({
      where: { source: SOURCE_TAG }
    });
    console.log(`   Deleted ${deleted.count} existing descriptors`);
  }

  // Import in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;

  console.log('\n📥 Importing descriptors...');

  for (let i = 0; i < descriptors.length; i += BATCH_SIZE) {
    const batch = descriptors.slice(i, i + BATCH_SIZE);

    try {
      const result = await prisma.descriptor.createMany({
        data: batch.map(d => ({
          code: d.code,
          criterionName: d.criterionName,
          score3: d.score3 || null,
          score2: d.score2 || null,
          score1: d.score1 || null,
          score0: d.score0 || null,
          categories: d.categories || [],
          tags: d.tags || [],
          skillNames: d.skillNames || [],
          source: SOURCE_TAG, // Use our source tag
          qualityIndicator: QualityIndicator.NEEDS_REVIEW,
          version: d.version || 1
        })),
        skipDuplicates: true
      });

      inserted += result.count;
      skipped += batch.length - result.count;

      const progress = Math.round(((i + batch.length) / descriptors.length) * 100);
      process.stdout.write(`\r   Progress: ${progress}% (${inserted} inserted, ${skipped} skipped)`);
    } catch (error) {
      console.error(`\n❌ Error in batch starting at ${i}:`, error);
    }
  }

  console.log('\n');
  console.log('✅ Import complete!');
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped (duplicates): ${skipped}`);

  // Verify
  const totalCount = await prisma.descriptor.count({
    where: { source: SOURCE_TAG }
  });
  console.log(`   Total '${SOURCE_TAG}' descriptors in database: ${totalCount}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
