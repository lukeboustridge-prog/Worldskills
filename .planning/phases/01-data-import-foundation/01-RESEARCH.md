# Phase 1: Data Import & Foundation - Research

**Researched:** 2026-02-01
**Domain:** Excel parsing, bulk database imports, PostgreSQL full-text search
**Confidence:** HIGH

## Summary

This phase involves parsing 58 WSC2024 Excel marking scheme files to extract ~12,000 descriptors and importing them into a PostgreSQL database with full-text search capabilities. The research confirms that ExcelJS (not SheetJS) is the current standard for Excel parsing due to security concerns with SheetJS, PostgreSQL native full-text search with GIN indexes is sufficient for this corpus size, and Prisma's transaction patterns provide robust bulk import capabilities.

The standard approach involves: (1) conducting an upfront survey of all 58 files to detect structural variance and plan parser configuration, (2) using ExcelJS for parsing with explicit merged cell handling, (3) normalizing text with Unicode NFC and smart quote conversion, (4) importing in transaction-wrapped batches of 500-1000 records, and (5) implementing schema versioning from day 1 with a version field and expand-contract migration pattern.

**Primary recommendation:** Survey all 58 files first to detect variance, use ExcelJS 4.4+ with manual merged cell detection, normalize text immediately after extraction, batch import with Prisma transactions (500-1000 records per batch), and implement GIN indexes for full-text search after initial import completes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ExcelJS | 4.4.0+ | Excel file parsing | Actively maintained, no known vulnerabilities (unlike SheetJS), robust merged cell support, TypeScript types included |
| Prisma ORM | 5.20.0+ | Database operations and migrations | Project's existing ORM, built-in transaction support, type-safe bulk operations |
| PostgreSQL | Current | Database with FTS | Project's existing database, native full-text search (GIN indexes), handles <100k descriptors efficiently |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.x | Runtime validation | Validate extracted descriptor data before DB insert |
| Node.js native `String.normalize()` | Built-in | Unicode normalization | Convert Unicode to NFC form for consistency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ExcelJS | SheetJS (xlsx) | SheetJS has known security vulnerabilities (CVE-2023-30533), abandoned npm registry, latest secure version only on CDN with no checksums |
| PostgreSQL FTS | Elasticsearch | Adds infrastructure complexity, unnecessary for <100k records, PostgreSQL FTS handles 1.5M records in ~100ms |
| Synchronous import | Background job queue | Adds complexity, unnecessary for one-time import of ~12k records (estimated <30s total) |

**Installation:**
```bash
npm install exceljs
# Prisma and PostgreSQL already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── import/
│   ├── excel-parser.ts      # ExcelJS parsing logic
│   ├── text-normalizer.ts   # Unicode normalization
│   ├── validator.ts          # Zod schemas for descriptors
│   └── importer.ts           # Bulk import orchestration
└── descriptors.ts            # Query/search logic (future phases)

prisma/
├── migrations/
│   └── 00XX_add_descriptors/ # Migration with GIN index
└── schema.prisma             # Descriptor models
```

### Pattern 1: Upfront File Survey Before Parsing
**What:** Analyze all 58 files to detect structural variance before building parser
**When to use:** When parsing heterogeneous files from multiple sources (different skills/authors)
**Example:**
```typescript
// src/lib/import/file-surveyor.ts
interface FileStructure {
  filePath: string;
  sheetNames: string[];
  headerRow: number;
  columns: { name: string; index: number }[];
  hasMergedCells: boolean;
  sampleRows: number;
  encoding: string;
}

async function surveyAllFiles(directory: string): Promise<FileStructure[]> {
  const files = await fs.readdir(directory);
  const structures = [];

  for (const file of files) {
    if (!file.endsWith('.xlsx')) continue;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(directory, file));

    const sheet = workbook.worksheets[0]; // Or find by name
    const structure: FileStructure = {
      filePath: file,
      sheetNames: workbook.worksheets.map(ws => ws.name),
      headerRow: detectHeaderRow(sheet),
      columns: extractColumns(sheet),
      hasMergedCells: Object.keys(sheet._merges || {}).length > 0,
      sampleRows: sheet.rowCount,
      encoding: 'UTF-8' // ExcelJS handles encoding
    };

    structures.push(structure);
  }

  // Analyze variance
  const columnVariance = analyzeColumnVariance(structures);
  console.log('Column structure variance:', columnVariance);

  return structures;
}
```

**Why this matters:** WSC2024 marking schemes from 58 skills likely have variance in column names, sheet names, merged cell usage. Surveying first prevents parser failures at file 45/58.

### Pattern 2: Explicit Merged Cell Detection with ExcelJS
**What:** Manually check for merged cells and extract master cell value
**When to use:** Always when parsing real-world Excel files (merged cells are common in headers/categories)
**Example:**
```typescript
// src/lib/import/excel-parser.ts
import ExcelJS from 'exceljs';

interface DescriptorRow {
  code: string;
  title: string;
  excellent: string;
  good: string;
  pass: string;
  belowPass: string;
  skillName: string;
}

async function parseMarkingScheme(filePath: string, skillName: string): Promise<DescriptorRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Find the marking scheme sheet (vary by file survey results)
  const sheet = workbook.getWorksheet('Marking Scheme')
    || workbook.worksheets[0];

  const descriptors: DescriptorRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return; // Skip headers (adjust based on survey)

    // Get cell values, handling merged cells
    const code = getCellValue(row, 1, sheet);
    const title = getCellValue(row, 2, sheet);
    const excellent = getCellValue(row, 3, sheet);
    const good = getCellValue(row, 4, sheet);
    const pass = getCellValue(row, 5, sheet);
    const belowPass = getCellValue(row, 6, sheet);

    if (!code || !title) return; // Skip empty rows

    descriptors.push({
      code: code.trim(),
      title: title.trim(),
      excellent: excellent?.trim() || '',
      good: good?.trim() || '',
      pass: pass?.trim() || '',
      belowPass: belowPass?.trim() || '',
      skillName
    });
  });

  return descriptors;
}

function getCellValue(row: ExcelJS.Row, colNumber: number, sheet: ExcelJS.Worksheet): string {
  const cell = row.getCell(colNumber);

  // Check if cell is part of a merged range
  if (cell.isMerged && cell.master) {
    // Return the master cell's value
    return cell.master.text || '';
  }

  return cell.text || '';
}
```

**Known issue:** ExcelJS has reported issues with `addRow()` not preserving merged cells correctly. Since we're only *reading*, this doesn't affect us. Always use `.text` property for string values (handles formulas, numbers, dates).

### Pattern 3: Text Normalization Pipeline
**What:** Convert Unicode artifacts, smart quotes, bullets to consistent ASCII/NFC
**When to use:** Immediately after extracting text from Excel, before database insertion
**Example:**
```typescript
// src/lib/import/text-normalizer.ts

/**
 * Normalizes text extracted from Excel files to ensure consistency
 * Handles: smart quotes, Unicode bullets, normalization form
 */
export function normalizeDescriptorText(text: string): string {
  if (!text) return '';

  // Step 1: Normalize to Unicode NFC (composed form)
  // Ensures "é" is stored as single character, not "e" + combining accent
  let normalized = text.normalize('NFC');

  // Step 2: Convert smart quotes to straight quotes
  normalized = normalized
    .replace(/[\u2018\u2019]/g, "'")  // ' ' → '
    .replace(/[\u201C\u201D]/g, '"')  // " " → "

  // Step 3: Convert Unicode bullets to hyphens
  normalized = normalized
    .replace(/[\u2022\u2023\u2043]/g, '-')  // • ‣ ⁃ → -
    .replace(/\u25E6/g, '-')                // ◦ → -

  // Step 4: Convert non-breaking spaces to regular spaces
  normalized = normalized.replace(/\u00A0/g, ' ');

  // Step 5: Normalize whitespace (collapse multiple spaces)
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Detects potential encoding issues in text
 * Returns warnings if suspicious patterns found
 */
export function detectEncodingIssues(text: string): string[] {
  const warnings: string[] = [];

  // Check for mojibake patterns (common encoding errors)
  if (/Ã©|Ã¨|Ã |â€™|â€œ/.test(text)) {
    warnings.push('Possible UTF-8 mojibake detected');
  }

  // Check for replacement characters (encoding failure)
  if (/\uFFFD/.test(text)) {
    warnings.push('Unicode replacement character found (encoding failure)');
  }

  // Check for control characters (shouldn't be in descriptors)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    warnings.push('Control characters detected');
  }

  return warnings;
}
```

**Why NFC over NFD:** NFC (Composed) is recommended by W3C and RDF standards. More compact, better for database storage, most systems expect NFC.

### Pattern 4: Batched Transaction Import
**What:** Import descriptors in batches of 500-1000 within transactions, not all 12k at once
**When to use:** Bulk imports of thousands of records
**Example:**
```typescript
// src/lib/import/importer.ts
import { prisma } from '@/lib/prisma';

interface DescriptorImportData {
  code: string;
  title: string;
  description: string;
  category?: string;
  source: string;
  skillName: string;
  version: number;
}

async function importDescriptors(descriptors: DescriptorImportData[]): Promise<void> {
  const BATCH_SIZE = 500; // Avoids long-running transactions
  const batches = chunk(descriptors, BATCH_SIZE);

  console.log(`Importing ${descriptors.length} descriptors in ${batches.length} batches...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      await prisma.$transaction(async (tx) => {
        // Use createMany for bulk insert (atomic within batch)
        await tx.descriptor.createMany({
          data: batch.map(d => ({
            code: d.code,
            title: d.title,
            description: d.description,
            category: d.category,
            source: d.source,
            skillName: d.skillName,
            version: d.version,
            createdAt: new Date()
          })),
          skipDuplicates: true // Skip if code already exists
        });
      });

      console.log(`✓ Batch ${i + 1}/${batches.length} complete (${batch.length} records)`);

    } catch (error) {
      console.error(`✗ Batch ${i + 1} failed:`, error);

      // Log failed records for manual review
      await logFailedBatch(batch, error);

      // Decision point: continue with next batch or abort?
      // For one-time import: continue, track failures
      // For production: might want to abort
    }
  }
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function logFailedBatch(batch: DescriptorImportData[], error: unknown): Promise<void> {
  // Write to file for manual review
  const timestamp = new Date().toISOString();
  const logPath = `./import-failures-${timestamp}.json`;

  await fs.writeFile(logPath, JSON.stringify({
    timestamp,
    error: error instanceof Error ? error.message : String(error),
    records: batch
  }, null, 2));

  console.log(`Failed batch logged to: ${logPath}`);
}
```

**Why batching:** Prisma docs warn "Keeping transactions open for a long time hurts database performance and can even cause deadlocks." 500-1000 records per batch is safe.

### Pattern 5: Schema Versioning from Day 1
**What:** Include version field in Descriptor model for future migrations
**When to use:** Always for data that may need schema changes later
**Example:**
```prisma
// prisma/schema.prisma
model Descriptor {
  id          String   @id @default(cuid())
  code        String   @unique
  title       String
  description String   @db.Text

  // Performance levels (grouped in single record)
  excellent   String?  @db.Text
  good        String?  @db.Text
  pass        String?  @db.Text
  belowPass   String?  @db.Text

  // Metadata
  category    String?
  source      String   // "WSC2024", "Manual", etc.
  skillName   String
  sector      String?

  // Schema versioning
  version     Int      @default(1)  // Start at 1 for WSC2024 import

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations (future phases)
  tags        DescriptorTagRelation[]

  @@index([category])
  @@index([source])
  @@index([skillName])
  @@index([version])
}
```

**Migration strategy (expand-contract pattern):**
1. **Expand:** Add new field/structure alongside old
2. **Migrate data:** Copy/transform from old to new
3. **Contract:** Remove old field/structure after all code updated

Example: If we later need to split `description` into `descriptionText` + `descriptionHtml`:
- Migration 1: Add `descriptionHtml` (nullable)
- Migration 2: Populate `descriptionHtml` from `description`
- Migration 3: Application code uses `descriptionHtml`
- Migration 4: Remove `description` field

**Rollback support:** Use Prisma's `migrate diff` to generate down migrations, but prefer database snapshots before major migrations.

### Pattern 6: GIN Index After Import
**What:** Create GIN index for full-text search after bulk import completes
**When to use:** Always for text search on large fields
**Example:**
```sql
-- In Prisma migration file: prisma/migrations/XXXX_add_fts_index/migration.sql

-- Create GIN index for full-text search on title + description
CREATE INDEX descriptor_fts_idx ON "Descriptor"
USING gin(
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(code, '')
  )
);

-- Optional: Add index on combined performance levels for searching within criteria
CREATE INDEX descriptor_levels_fts_idx ON "Descriptor"
USING gin(
  to_tsvector('english',
    coalesce(excellent, '') || ' ' ||
    coalesce(good, '') || ' ' ||
    coalesce(pass, '') || ' ' ||
    coalesce(belowPass, '')
  )
);
```

**Why after import:** Building GIN index on empty table is instant. Building on 12k records takes ~1-2 seconds. Building during import slows each insert by 10-100x.

**Query pattern:**
```typescript
// src/lib/descriptors.ts
async function searchDescriptors(query: string, filters?: { category?: string }) {
  return await prisma.$queryRaw`
    SELECT
      id, code, title, description, category, skillName,
      ts_rank(
        to_tsvector('english', title || ' ' || description),
        plainto_tsquery('english', ${query})
      ) as rank
    FROM "Descriptor"
    WHERE to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', ${query})
      ${filters?.category ? Prisma.sql`AND category = ${filters.category}` : Prisma.empty}
    ORDER BY rank DESC, code ASC
    LIMIT 50
  `;
}
```

### Anti-Patterns to Avoid

- **Parsing all files without survey:** File 45 fails with different structure, wastes progress
- **Using SheetJS (xlsx package):** Known security vulnerabilities, not published to npm registry anymore
- **Ignoring merged cells:** Extracts only first cell of merged range, loses data
- **Skipping text normalization:** Smart quotes stored as Unicode, search doesn't match
- **Single giant transaction for 12k records:** Can cause deadlocks, unrecoverable failures
- **Storing performance levels as separate records:** Creates 48k records instead of 12k, complex queries
- **Building GIN index before import:** Slows import by 10-100x

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel parsing | Manual XML parsing of .xlsx files | ExcelJS | .xlsx is ZIP of XML files with complex schema, ExcelJS handles merged cells, formulas, encoding |
| Unicode normalization | Custom find/replace for smart quotes | `String.normalize('NFC')` + standard char replacements | Unicode has 143k+ characters, normalization is complex, browser API is standard |
| Transaction batching | Manual chunking with error recovery | Prisma `$transaction([])` with batch wrapper | Prisma handles rollback, isolation levels, connection pooling |
| Full-text search | Custom `LIKE '%query%'` queries | PostgreSQL `to_tsvector` + GIN index | FTS handles stemming (run/running), ranking, stop words, 100x faster |
| Progress tracking | Custom database table for import status | Simple file logging + batch console output | One-time import doesn't justify infrastructure, file logs sufficient |
| Schema migrations | Hand-written SQL files | Prisma Migrate | Tracks history, generates idempotent SQL, TypeScript type generation |

**Key insight:** Excel parsing and text normalization are the high-risk components. ExcelJS and Unicode normalization standards eliminate 90% of edge cases that would take weeks to discover manually.

## Common Pitfalls

### Pitfall 1: Assuming Homogeneous File Structure Across 58 Files
**What goes wrong:** Parser works on first 20 files, fails at file 21 with different column order/names
**Why it happens:** Different Skill Advisors created marking schemes with different templates
**How to avoid:** Survey ALL files first (Pattern 1), detect variance, design parser config to handle variance
**Warning signs:** "Column 'Descriptor' not found" errors during import, null values for expected fields
**Prevention cost:** 30 minutes to survey vs. 4 hours to debug and re-import

### Pitfall 2: Using SheetJS (xlsx) Due to Popularity
**What goes wrong:** Security scanners flag CVE-2023-30533, npm install fails or requires CDN workaround
**Why it happens:** SheetJS was standard until 2023, many tutorials still reference it
**How to avoid:** Use ExcelJS 4.4+ (no known vulnerabilities, actively maintained, published to npm)
**Warning signs:** npm audit warnings, packages requiring SheetJS CDN with manual overrides
**Impact:** Security vulnerability in production, supply chain risk

### Pitfall 3: Importing Without Text Normalization
**What goes wrong:** Search for "welding" doesn't match "welding" (different Unicode for apostrophes in nearby text), smart quotes don't match straight quotes
**Why it happens:** Excel stores rich text with Unicode formatting, copy-paste introduces mixed encodings
**How to avoid:** Normalize with `String.normalize('NFC')` and smart quote replacement (Pattern 3)
**Warning signs:** Search returning fewer results than expected, text looks identical but doesn't match
**Detection:** Run `detectEncodingIssues()` on sample of extracted text before import

### Pitfall 4: Single Transaction for All 12k Records
**What goes wrong:** Transaction runs for 30+ seconds, locks tables, potential timeout, if any record fails all 12k roll back
**Why it happens:** Misunderstanding of "transaction safety" - assume bigger transaction = safer
**How to avoid:** Batch 500-1000 records per transaction (Pattern 4), log failures, continue on error
**Warning signs:** "Transaction timeout" errors, database connection pool exhaustion
**Recovery:** With batching, only failed batch needs re-import (500 records), not all 12k

### Pitfall 5: Not Handling Merged Cells Explicitly
**What goes wrong:** Category headers in merged cells extracted as empty string, descriptors missing category metadata
**Why it happens:** Assuming `row.getCell(1).value` works for all cells (merged cells return value only in master)
**How to avoid:** Check `cell.isMerged` and access `cell.master.text` (Pattern 2)
**Warning signs:** Missing category/section data, empty fields where Excel shows values
**Detection:** Survey should report `hasMergedCells: true` for files using merged headers

### Pitfall 6: Building GIN Index Before Import
**What goes wrong:** Import takes 10-100x longer (each insert updates index), import of 12k records takes 30 minutes instead of 30 seconds
**Why it happens:** Adding index in same migration as table creation, following "always index foreign keys" pattern
**How to avoid:** Create GIN index in separate migration AFTER bulk import completes (Pattern 6)
**Warning signs:** Import progress extremely slow (<100 records/second with GIN index vs. 10k/second without)
**Best practice:** Create B-tree indexes (foreign keys, simple fields) with table, create GIN indexes after data loaded

### Pitfall 7: Storing Performance Levels as Separate Records
**What goes wrong:** 12k descriptors become 48k records (4 levels each), queries require complex joins, increased storage
**Why it happens:** Over-normalization, thinking "performance level" is an entity
**How to avoid:** Store performance levels as fields in single Descriptor record (Pattern 5)
**Trade-off:** Slight duplication (column names), but massive query simplification and storage savings
**Use case:** If we needed to search "all Excellent-level criteria", we'd still use FTS on the `excellent` field

## Code Examples

Verified patterns from official sources and community best practices:

### Survey All Files Upfront
```typescript
// src/scripts/survey-marking-schemes.ts
import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import path from 'path';

const SOURCE_DIR = 'C:\\Users\\LukeBoustridge\\Dropbox\\WSI standards and assessment\\WSC2024\\Skill Advisors\\Final MS by Skill';

interface ColumnInfo {
  name: string;
  index: number;
  sampleValues: string[];
}

async function surveyFile(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  const sheetNames = workbook.worksheets.map(ws => ws.name);

  // Detect header row (first row with 3+ non-empty cells)
  let headerRow = 1;
  for (let i = 1; i <= Math.min(10, sheet.rowCount); i++) {
    const row = sheet.getRow(i);
    const nonEmpty = row.values.filter(v => v).length;
    if (nonEmpty >= 3) {
      headerRow = i;
      break;
    }
  }

  // Extract column info
  const headerRowData = sheet.getRow(headerRow);
  const columns: ColumnInfo[] = [];

  headerRowData.eachCell((cell, colNumber) => {
    const sampleValues: string[] = [];
    for (let r = headerRow + 1; r <= Math.min(headerRow + 5, sheet.rowCount); r++) {
      const value = sheet.getRow(r).getCell(colNumber).text;
      if (value) sampleValues.push(value);
    }

    columns.push({
      name: cell.text || `Column${colNumber}`,
      index: colNumber,
      sampleValues
    });
  });

  return {
    fileName: path.basename(filePath),
    sheetNames,
    headerRow,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    hasMergedCells: Object.keys(sheet._merges || {}).length > 0,
    columns
  };
}

async function surveyAllFiles() {
  const files = await fs.readdir(SOURCE_DIR);
  const xlsxFiles = files.filter(f => f.endsWith('.xlsx'));

  console.log(`Surveying ${xlsxFiles.length} files...`);

  const results = [];
  for (const file of xlsxFiles) {
    console.log(`  Surveying: ${file}`);
    const result = await surveyFile(path.join(SOURCE_DIR, file));
    results.push(result);
  }

  // Analyze variance
  const columnNamesSet = new Set(
    results.flatMap(r => r.columns.map(c => c.name.toLowerCase()))
  );

  console.log('\n=== SURVEY RESULTS ===');
  console.log(`Files surveyed: ${results.length}`);
  console.log(`Unique column names: ${columnNamesSet.size}`);
  console.log(`Files with merged cells: ${results.filter(r => r.hasMergedCells).length}`);

  // Save detailed report
  await fs.writeFile(
    './survey-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\nDetailed survey saved to: ./survey-results.json');
}

surveyAllFiles().catch(console.error);
```

### Parse Single File with Normalization
```typescript
// src/lib/import/excel-parser.ts
import ExcelJS from 'exceljs';
import { normalizeDescriptorText } from './text-normalizer';

interface ParsedDescriptor {
  code: string;
  title: string;
  excellent: string;
  good: string;
  pass: string;
  belowPass: string;
  category?: string;
}

export async function parseMarkingScheme(
  filePath: string,
  config: {
    sheetName?: string;
    headerRow: number;
    columns: {
      code: number;
      title: number;
      excellent: number;
      good: number;
      pass: number;
      belowPass: number;
      category?: number;
    };
  }
): Promise<ParsedDescriptor[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = config.sheetName
    ? workbook.getWorksheet(config.sheetName)
    : workbook.worksheets[0];

  if (!sheet) {
    throw new Error(`Sheet not found: ${config.sheetName || 'first sheet'}`);
  }

  const descriptors: ParsedDescriptor[] = [];

  sheet.eachRow((row, rowNumber) => {
    // Skip header and empty rows
    if (rowNumber <= config.headerRow) return;

    const code = getCellText(row, config.columns.code, sheet);
    const title = getCellText(row, config.columns.title, sheet);

    // Skip if missing required fields
    if (!code || !title) return;

    const descriptor: ParsedDescriptor = {
      code: normalizeDescriptorText(code),
      title: normalizeDescriptorText(title),
      excellent: normalizeDescriptorText(getCellText(row, config.columns.excellent, sheet)),
      good: normalizeDescriptorText(getCellText(row, config.columns.good, sheet)),
      pass: normalizeDescriptorText(getCellText(row, config.columns.pass, sheet)),
      belowPass: normalizeDescriptorText(getCellText(row, config.columns.belowPass, sheet)),
    };

    if (config.columns.category) {
      const category = getCellText(row, config.columns.category, sheet);
      if (category) {
        descriptor.category = normalizeDescriptorText(category);
      }
    }

    descriptors.push(descriptor);
  });

  return descriptors;
}

function getCellText(row: ExcelJS.Row, colNumber: number, sheet: ExcelJS.Worksheet): string {
  const cell = row.getCell(colNumber);

  // Handle merged cells
  if (cell.isMerged && cell.master) {
    return cell.master.text || '';
  }

  return cell.text || '';
}
```

### Bulk Import with Progress Tracking
```typescript
// src/scripts/import-wsc2024-descriptors.ts
import { prisma } from '@/lib/prisma';
import { parseMarkingScheme } from '@/lib/import/excel-parser';
import fs from 'fs/promises';
import path from 'path';

const SOURCE_DIR = 'C:\\Users\\LukeBoustridge\\Dropbox\\WSI standards and assessment\\WSC2024\\Skill Advisors\\Final MS by Skill';
const BATCH_SIZE = 500;
const VERSION = 1; // WSC2024 initial import

async function importAllMarkingSchemes() {
  // Load survey results to get parser config for each file
  const surveyResults = JSON.parse(
    await fs.readFile('./survey-results.json', 'utf-8')
  );

  const allDescriptors = [];
  const errors = [];

  console.log(`Parsing ${surveyResults.length} marking schemes...`);

  for (const survey of surveyResults) {
    try {
      const filePath = path.join(SOURCE_DIR, survey.fileName);

      // Generate config from survey (or use manual mapping)
      const config = generateParserConfig(survey);

      const descriptors = await parseMarkingScheme(filePath, config);

      // Add metadata
      const skillName = extractSkillName(survey.fileName);
      const enriched = descriptors.map(d => ({
        ...d,
        skillName,
        source: 'WSC2024',
        version: VERSION
      }));

      allDescriptors.push(...enriched);

      console.log(`✓ ${survey.fileName}: ${descriptors.length} descriptors`);

    } catch (error) {
      console.error(`✗ ${survey.fileName}:`, error.message);
      errors.push({ file: survey.fileName, error: error.message });
    }
  }

  console.log(`\nTotal descriptors parsed: ${allDescriptors.length}`);
  console.log(`Files with errors: ${errors.length}`);

  if (errors.length > 0) {
    await fs.writeFile('./import-errors.json', JSON.stringify(errors, null, 2));
    console.log('Errors logged to: ./import-errors.json');
  }

  // Import to database in batches
  await importDescriptorsBatched(allDescriptors);
}

async function importDescriptorsBatched(descriptors: any[]) {
  const batches = chunk(descriptors, BATCH_SIZE);

  console.log(`\nImporting ${descriptors.length} descriptors in ${batches.length} batches...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      await prisma.$transaction(async (tx) => {
        await tx.descriptor.createMany({
          data: batch.map(d => ({
            code: d.code,
            title: d.title,
            description: d.title, // Or combine levels
            excellent: d.excellent,
            good: d.good,
            pass: d.pass,
            belowPass: d.belowPass,
            category: d.category,
            source: d.source,
            skillName: d.skillName,
            version: d.version
          })),
          skipDuplicates: true // Ignore duplicate codes
        });
      });

      successCount += batch.length;
      console.log(`  Batch ${i + 1}/${batches.length}: ✓ ${batch.length} records`);

    } catch (error) {
      failCount += batch.length;
      console.error(`  Batch ${i + 1}/${batches.length}: ✗`, error.message);

      // Log failed batch
      await fs.writeFile(
        `./failed-batch-${i + 1}.json`,
        JSON.stringify(batch, null, 2)
      );
    }
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Success: ${successCount} records`);
  console.log(`Failed: ${failCount} records`);
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function extractSkillName(fileName: string): string {
  // Remove extension and clean up
  // "01 - Bricklaying.xlsx" → "Bricklaying"
  return fileName
    .replace(/\.xlsx$/i, '')
    .replace(/^\d+\s*-\s*/, '')
    .trim();
}

function generateParserConfig(survey: any) {
  // Generate config based on survey results
  // This would map detected columns to expected fields
  // Example: find column with "Code" or "ID" for code field

  const findColumn = (names: string[]) => {
    const col = survey.columns.find(c =>
      names.some(name => c.name.toLowerCase().includes(name.toLowerCase()))
    );
    return col?.index || 1;
  };

  return {
    headerRow: survey.headerRow,
    columns: {
      code: findColumn(['code', 'id', 'ref']),
      title: findColumn(['title', 'descriptor', 'criteria']),
      excellent: findColumn(['excellent', 'exc', 'outstanding']),
      good: findColumn(['good', 'satisfactory']),
      pass: findColumn(['pass', 'acceptable', 'adequate']),
      belowPass: findColumn(['below', 'poor', 'unsatisfactory']),
      category: findColumn(['category', 'section', 'aspect'])
    }
  };
}

importAllMarkingSchemes().catch(console.error);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SheetJS (xlsx) for Excel parsing | ExcelJS | 2023-2024 | SheetJS security vulnerabilities, abandoned npm registry, ExcelJS is maintained and secure |
| Elasticsearch for all text search | PostgreSQL FTS with GIN | 2020+ | PostgreSQL FTS sufficient for <1M records, eliminates infrastructure complexity |
| Manual Unicode replacement | `String.normalize('NFC')` | Native API since ES6 (2015) | Standard, reliable, handles all Unicode normalization forms |
| Single giant transaction | Batched transactions | Best practice 2020+ | Avoids deadlocks, faster, better error recovery |
| Data in JSON columns | Dedicated columns for performance levels | Domain-specific | Better type safety, simpler queries, FTS indexable |

**Deprecated/outdated:**
- **SheetJS (xlsx) via npm:** Latest secure version (0.19.3+) only on CDN, npm has CVE-2023-30533
- **Client-side Excel parsing:** File size limits, security risks (upload to server, parse server-side)
- **GiST indexes for FTS:** GIN is 3x faster for lookups (GiST better for updates, but we have one-time import)

## Open Questions

Things that couldn't be fully resolved:

1. **What is the actual column structure variance across all 58 files?**
   - What we know: WSC2024 files likely have variance (different authors/templates)
   - What's unclear: Exact column names, header row positions, merged cell patterns
   - Recommendation: Run survey script first (Pattern 1), analyze variance, build parser config map

2. **Should we store performance levels (Excellent/Good/Pass/Below Pass) as separate records or fields?**
   - What we know: Architecture doc shows separate fields, enables simpler queries
   - What's unclear: If we need to query "all Excellent criteria across skills" - separate records might help
   - Recommendation: Use fields (Pattern 5) - simpler, can still query individual levels with FTS

3. **Should import be synchronous or background job?**
   - What we know: ~12k records, estimated 30-60 seconds with batching, one-time operation
   - What's unclear: If admin needs to stay on page or can navigate away
   - Recommendation: Synchronous with progress logging (server console), add background job if import exceeds 2 minutes in practice

4. **How to handle duplicate codes across skills?**
   - What we know: Code field is `@unique`, `skipDuplicates: true` will skip
   - What's unclear: If same code in different skills means "same descriptor" or "coincidence"
   - Recommendation: Make code unique per skill: `code: "${skillName}-${code}"` or composite unique `@@unique([skillName, code])`

5. **Should we enable Prisma's fullTextSearch preview feature?**
   - What we know: Prisma has `fullTextSearch` preview feature for PostgreSQL
   - What's unclear: Feature stability, whether it simplifies our use case
   - Recommendation: Use raw SQL `$queryRaw` for FTS (Pattern 6) - more control, better understood by team

## Sources

### Primary (HIGH confidence)
- [ExcelJS GitHub Repository](https://github.com/exceljs/exceljs) - Official library documentation and features
- [ExcelJS security status via Snyk](https://security.snyk.io/package/npm/exceljs) - No known vulnerabilities
- [Prisma Transactions Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) - Official transaction patterns
- [PostgreSQL Full-Text Search Documentation](https://www.postgresql.org/docs/current/textsearch-indexes.html) - GIN index specification
- [MDN String.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) - Unicode normalization API
- Existing project: `C:\Users\LukeBoustridge\Projects\Worldskills\prisma\schema.prisma` - Current patterns

### Secondary (MEDIUM confidence)
- [Understanding Postgres GIN Indexes: The Good and the Bad](https://pganalyze.com/blog/gin-index) - Performance data
- [Mastering Bulk Inserts in Prisma](https://ivanspoljaric22.medium.com/mastering-bulk-inserts-in-prisma-best-practices-for-performance-integrity-2ba531f86f74) - Best practices
- [Prisma Migration Strategies](https://www.prisma.io/dataguide/types/relational/migration-strategies) - Expand-contract pattern
- [Text Workflow Hygiene: Unicode Artifacts](https://invisiblefix.app/text-workflow-hygiene/) - 2025/2026 best practices
- [W3C Unicode Normalization](https://www.w3.org/International/questions/qa-html-css-normalization) - NFC recommendation

### Tertiary (LOW confidence, needs validation)
- [SheetJS npm package issues](https://git.sheetjs.com/sheetjs/sheetjs/issues/3048) - Community reports of vulnerabilities
- [ExcelJS merged cell handling issues](https://github.com/exceljs/exceljs/issues/1567) - Known issue with addRow (doesn't affect read-only use)
- [Next.js long-running tasks discussion](https://github.com/vercel/next.js/discussions/34266) - Background job patterns (if needed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ExcelJS verified secure, Prisma/PostgreSQL already in project
- Architecture: HIGH - All patterns verified from official documentation and existing codebase
- Pitfalls: MEDIUM-HIGH - Mix of official documentation and community experience

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days) - Excel parsing and PostgreSQL FTS are stable technologies

**Critical decision for planner:**
- Survey first approach (Pattern 1) is MANDATORY - don't skip this step
- ExcelJS over SheetJS is NON-NEGOTIABLE (security)
- Text normalization (Pattern 3) is REQUIRED before DB insert
- Batched transactions (Pattern 4) is REQUIRED for 12k records
