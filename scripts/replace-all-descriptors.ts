/**
 * Full Replacement of All Descriptors
 *
 * This script deletes ALL existing descriptors and imports from the new JSON file.
 *
 * Usage: npx tsx scripts/replace-all-descriptors.ts [--dry-run]
 */

import { PrismaClient, QualityIndicator } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface JsonDescriptor {
  code: string;
  criterionName: string;
  score3?: string;
  score2?: string;
  score1?: string;
  score0?: string;
  categories: string[];
  tags: string[];
  skillNames: string[];
  source: string;
  qualityIndicator: string;
  version: number;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Path to new JSON file
  const jsonPath = path.resolve(
    'C:\\Users\\LukeBoustridge\\Projects\\Worldskills\\Workinprogress\\Descriptors\\WorldSkills_Descriptors_228_POSITIVE.json'
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
  for (const [cat, count] of sortedCategories.slice(0, 15)) {
    console.log(`   ${cat}: ${count}`);
  }
  if (sortedCategories.length > 15) {
    console.log(`   ... and ${sortedCategories.length - 15} more categories`);
  }

  // Check existing count
  const existingCount = await prisma.descriptor.count();
  console.log(`\n📊 Current descriptors in database: ${existingCount}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made');
    console.log(`   Would delete: ${existingCount} descriptors`);
    console.log(`   Would insert: ${descriptors.length} descriptors`);
    await prisma.$disconnect();
    return;
  }

  // Delete all existing descriptors (including favorites first due to FK constraint)
  console.log('\n🗑️  Deleting all existing descriptor favorites...');
  const deletedFavorites = await prisma.descriptorFavorite.deleteMany({});
  console.log(`   Deleted ${deletedFavorites.count} favorites`);

  console.log('🗑️  Deleting all existing descriptors...');
  const deleted = await prisma.descriptor.deleteMany({});
  console.log(`   Deleted ${deleted.count} descriptors`);

  // Import in batches
  const BATCH_SIZE = 50;
  let inserted = 0;

  console.log('\n📥 Importing new descriptors...');

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
          source: d.source || 'WSC2024',
          qualityIndicator: (d.qualityIndicator as QualityIndicator) || QualityIndicator.NEEDS_REVIEW,
          version: d.version || 1
        }))
      });

      inserted += result.count;

      const progress = Math.round(((i + batch.length) / descriptors.length) * 100);
      process.stdout.write(`\r   Progress: ${progress}% (${inserted} inserted)`);
    } catch (error) {
      console.error(`\n❌ Error in batch starting at ${i}:`, error);
    }
  }

  console.log('\n');
  console.log('✅ Full replacement complete!');
  console.log(`   Deleted: ${deleted.count} old descriptors`);
  console.log(`   Inserted: ${inserted} new descriptors`);

  // Verify
  const totalCount = await prisma.descriptor.count();
  console.log(`   Total descriptors in database: ${totalCount}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
