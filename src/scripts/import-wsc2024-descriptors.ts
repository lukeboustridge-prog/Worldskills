import fs from 'fs/promises';
import path from 'path';
import { parseMarkingScheme } from '@/lib/import/excel-parser';
import { validateDescriptorBatch, type DescriptorImport } from '@/lib/import/validator';
import { importDescriptors, countDescriptors, type ImportResult } from '@/lib/import/importer';

const SOURCE_DIR = 'C:\\Users\\LukeBoustridge\\Projects\\Workinprogress\\Marking Schemes';

interface FileParseResult {
  fileName: string;
  descriptorCount: number;
  validCount: number;
  invalidCount: number;
  warnings: number;
  errors: string[];
}

interface ImportReport {
  startTime: string;
  endTime: string;
  duration: string;
  sourceDirectory: string;
  fileResults: FileParseResult[];
  totalDescriptors: number;
  validDescriptors: number;
  invalidDescriptors: number;
  importResult: ImportResult | null;
  databaseCount: number;
}

async function runImport(): Promise<void> {
  const startTime = new Date();
  console.log('=== WSC2024 Descriptor Import ===');
  console.log(`Start time: ${startTime.toISOString()}`);
  console.log(`Source: ${SOURCE_DIR}\n`);

  // Get existing count
  const existingCount = await countDescriptors('WSC2024');
  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing WSC2024 descriptors.`);
    console.log('   New descriptors with duplicate [skillName, code] will be skipped.\n');
  }

  // Read all Excel files
  const files = await fs.readdir(SOURCE_DIR);
  const xlsxFiles = files.filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));

  console.log(`Found ${xlsxFiles.length} Excel files\n`);

  const fileResults: FileParseResult[] = [];
  const allDescriptors: DescriptorImport[] = [];

  // Parse all files
  console.log('--- PARSING PHASE ---');
  for (const file of xlsxFiles) {
    console.log(`  Parsing: ${file}`);

    const filePath = path.join(SOURCE_DIR, file);
    const { descriptors, errors, warnings } = await parseMarkingScheme(filePath);

    const validation = validateDescriptorBatch(descriptors);

    fileResults.push({
      fileName: file,
      descriptorCount: descriptors.length,
      validCount: validation.valid.length,
      invalidCount: validation.invalid.length,
      warnings: validation.allWarnings.length,
      errors
    });

    allDescriptors.push(...validation.valid);

    if (errors.length > 0) {
      console.log(`    ✗ Errors: ${errors.join(', ')}`);
    }
    if (validation.invalid.length > 0) {
      console.log(`    ⚠ Invalid: ${validation.invalid.length} descriptors skipped`);
    }
    console.log(`    ✓ Valid: ${validation.valid.length} descriptors`);
  }

  // Summary
  const totalParsed = fileResults.reduce((sum, f) => sum + f.descriptorCount, 0);
  const totalValid = allDescriptors.length;
  const totalInvalid = fileResults.reduce((sum, f) => sum + f.invalidCount, 0);

  console.log('\n--- PARSING SUMMARY ---');
  console.log(`Files processed: ${fileResults.length}`);
  console.log(`Total descriptors found: ${totalParsed}`);
  console.log(`Valid for import: ${totalValid}`);
  console.log(`Invalid (skipped): ${totalInvalid}`);

  // Import to database
  console.log('\n--- IMPORT PHASE ---');
  let importResult: ImportResult | null = null;

  if (allDescriptors.length > 0) {
    importResult = await importDescriptors(allDescriptors, { continueOnError: true });

    console.log('\n--- IMPORT SUMMARY ---');
    console.log(`Total processed: ${importResult.totalProcessed}`);
    console.log(`Successfully imported: ${importResult.successCount}`);
    console.log(`Duplicates skipped: ${importResult.duplicateCount}`);
    console.log(`Failed: ${importResult.failedCount}`);
  } else {
    console.log('No valid descriptors to import.');
  }

  // Final count
  const finalCount = await countDescriptors('WSC2024');

  const endTime = new Date();
  const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Duration: ${duration} seconds`);
  console.log(`WSC2024 descriptors in database: ${finalCount}`);

  // Save report
  const report: ImportReport = {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: `${duration}s`,
    sourceDirectory: SOURCE_DIR,
    fileResults,
    totalDescriptors: totalParsed,
    validDescriptors: totalValid,
    invalidDescriptors: totalInvalid,
    importResult,
    databaseCount: finalCount
  };

  const reportPath = path.join(process.cwd(), 'import-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
}

runImport().catch(error => {
  console.error('\n=== IMPORT FAILED ===');
  console.error(error);
  process.exit(1);
});
