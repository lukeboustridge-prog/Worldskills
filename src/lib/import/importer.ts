import { prisma } from '@/lib/prisma';
import type { DescriptorImport } from './validator';

const BATCH_SIZE = 100; // Smaller batches for Neon pgbouncer compatibility

export interface ImportResult {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  batches: BatchResult[];
}

export interface BatchResult {
  batchNumber: number;
  recordCount: number;
  success: boolean;
  insertedCount: number;
  error?: string;
  duration: number;
}

/**
 * Splits array into chunks of specified size.
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Imports descriptors in batched transactions.
 * Each batch is atomic - if a batch fails, only that batch rolls back.
 */
export async function importDescriptors(
  descriptors: DescriptorImport[],
  options: { continueOnError?: boolean } = {}
): Promise<ImportResult> {
  const { continueOnError = true } = options;

  const batches = chunk(descriptors, BATCH_SIZE);
  const batchResults: BatchResult[] = [];

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalDuplicates = 0;

  console.log(`\nImporting ${descriptors.length} descriptors in ${batches.length} batches...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const startTime = Date.now();

    try {
      // createMany is already atomic (single INSERT statement)
      // No explicit transaction needed - works with Neon's pgbouncer mode
      const result = await prisma.descriptor.createMany({
        data: batch.map(d => ({
          code: d.code,
          criterionName: d.criterionName,
          excellent: d.excellent,
          good: d.good,
          pass: d.pass,
          belowPass: d.belowPass,
          category: d.category,
          skillName: d.skillName,
          sector: d.sector,
          source: d.source,
          version: d.version,
          tags: d.tags
        })),
        skipDuplicates: true // Skip [skillName, code] duplicates
      });

      const duration = Date.now() - startTime;
      const duplicatesInBatch = batch.length - result.count;

      totalSuccess += result.count;
      totalDuplicates += duplicatesInBatch;

      batchResults.push({
        batchNumber: i + 1,
        recordCount: batch.length,
        success: true,
        insertedCount: result.count,
        duration
      });

      console.log(`  Batch ${i + 1}/${batches.length}: ✓ ${result.count} inserted (${duplicatesInBatch} duplicates) [${duration}ms]`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      totalFailed += batch.length;

      batchResults.push({
        batchNumber: i + 1,
        recordCount: batch.length,
        success: false,
        insertedCount: 0,
        error: errorMessage,
        duration
      });

      console.error(`  Batch ${i + 1}/${batches.length}: ✗ FAILED [${duration}ms]`);
      console.error(`    Error: ${errorMessage}`);

      if (!continueOnError) {
        throw new Error(`Import aborted at batch ${i + 1}: ${errorMessage}`);
      }
    }
  }

  return {
    totalProcessed: descriptors.length,
    successCount: totalSuccess,
    failedCount: totalFailed,
    duplicateCount: totalDuplicates,
    batches: batchResults
  };
}

/**
 * Counts existing descriptors by source.
 */
export async function countDescriptors(source?: string): Promise<number> {
  return prisma.descriptor.count({
    where: source ? { source } : undefined
  });
}

/**
 * Deletes all descriptors with a specific source (for reimport).
 */
export async function deleteDescriptorsBySource(source: string): Promise<number> {
  const result = await prisma.descriptor.deleteMany({
    where: { source }
  });
  return result.count;
}
