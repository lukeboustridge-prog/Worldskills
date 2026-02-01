import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import path from 'path';

const SOURCE_DIR = 'C:\\Users\\LukeBoustridge\\Projects\\Workinprogress\\Marking Schemes';

interface ColumnInfo {
  name: string;
  index: number;
  sampleValues: string[];
}

interface FileStructure {
  fileName: string;
  sheetNames: string[];
  headerRow: number;
  rowCount: number;
  columnCount: number;
  hasMergedCells: boolean;
  mergedCellCount: number;
  columns: ColumnInfo[];
  encoding: string;
  errors: string[];
}

async function surveyFile(filePath: string): Promise<FileStructure> {
  const errors: string[] = [];

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Find the main sheet (try common names first)
    let sheet = workbook.getWorksheet('Marking Scheme')
      || workbook.getWorksheet('MS')
      || workbook.worksheets[0];

    if (!sheet) {
      throw new Error('No worksheets found');
    }

    const sheetNames = workbook.worksheets.map(ws => ws.name);

    // Detect header row (first row with 3+ non-empty cells)
    let headerRow = 1;
    for (let i = 1; i <= Math.min(15, sheet.rowCount); i++) {
      const row = sheet.getRow(i);
      const values = row.values as (string | number | undefined)[];
      const nonEmpty = values.filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;
      if (nonEmpty >= 3) {
        headerRow = i;
        break;
      }
    }

    // Extract column info from header row
    const headerRowData = sheet.getRow(headerRow);
    const columns: ColumnInfo[] = [];

    headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const sampleValues: string[] = [];

      // Get sample values from next 5 data rows
      for (let r = headerRow + 1; r <= Math.min(headerRow + 6, sheet.rowCount); r++) {
        const dataCell = sheet.getRow(r).getCell(colNumber);
        const value = getCellText(dataCell, sheet);
        if (value && value.length > 0 && value.length < 100) {
          sampleValues.push(value.substring(0, 50));
        }
      }

      columns.push({
        name: getCellText(cell, sheet) || `Column${colNumber}`,
        index: colNumber,
        sampleValues: sampleValues.slice(0, 3)
      });
    });

    // Count merged cells
    const merges = (sheet as any)._merges || {};
    const mergedCellCount = Object.keys(merges).length;

    return {
      fileName: path.basename(filePath),
      sheetNames,
      headerRow,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      hasMergedCells: mergedCellCount > 0,
      mergedCellCount,
      columns,
      encoding: 'UTF-8',
      errors
    };

  } catch (error) {
    return {
      fileName: path.basename(filePath),
      sheetNames: [],
      headerRow: 0,
      rowCount: 0,
      columnCount: 0,
      hasMergedCells: false,
      mergedCellCount: 0,
      columns: [],
      encoding: 'unknown',
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

function getCellText(cell: ExcelJS.Cell, sheet: ExcelJS.Worksheet): string {
  // Handle merged cells - get master cell value
  if (cell.isMerged && cell.master) {
    return cell.master.text || '';
  }
  return cell.text || '';
}

async function surveyAllFiles(): Promise<void> {
  console.log(`Surveying files in: ${SOURCE_DIR}`);

  const files = await fs.readdir(SOURCE_DIR);
  const xlsxFiles = files.filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));

  console.log(`Found ${xlsxFiles.length} Excel files\n`);

  const results: FileStructure[] = [];

  for (let i = 0; i < xlsxFiles.length; i++) {
    const file = xlsxFiles[i];
    console.log(`  [${i + 1}/${xlsxFiles.length}] Surveying: ${file}`);
    const result = await surveyFile(path.join(SOURCE_DIR, file));
    results.push(result);

    if (result.errors.length > 0) {
      console.log(`    ERROR: ${result.errors.join(', ')}`);
    }
  }

  // Analyze variance
  const allColumnNames = new Set(
    results.flatMap(r => r.columns.map(c => c.name.toLowerCase().trim()))
  );

  const filesWithMergedCells = results.filter(r => r.hasMergedCells);
  const filesWithErrors = results.filter(r => r.errors.length > 0);

  console.log('\n=== SURVEY SUMMARY ===');
  console.log(`Total files surveyed: ${results.length}`);
  console.log(`Files with errors: ${filesWithErrors.length}`);
  console.log(`Files with merged cells: ${filesWithMergedCells.length}`);
  console.log(`Unique column names found: ${allColumnNames.size}`);
  console.log(`\nUnique column names:\n  ${Array.from(allColumnNames).sort().join('\n  ')}`);

  // Detect common column patterns for descriptor data
  const descriptorColumns = ['code', 'id', 'ref', 'aspect', 'criterion', 'criteria',
    'excellent', 'good', 'pass', 'below', 'satisfactory', 'acceptable', 'poor'];

  console.log('\n=== COLUMN PATTERN ANALYSIS ===');
  for (const pattern of descriptorColumns) {
    const matches = Array.from(allColumnNames).filter(c => c.includes(pattern));
    if (matches.length > 0) {
      console.log(`  "${pattern}": ${matches.join(', ')}`);
    }
  }

  // Save detailed results
  const outputPath = path.join(process.cwd(), 'survey-results.json');
  await fs.writeFile(outputPath, JSON.stringify({
    surveyDate: new Date().toISOString(),
    sourceDirectory: SOURCE_DIR,
    totalFiles: results.length,
    filesWithErrors: filesWithErrors.length,
    filesWithMergedCells: filesWithMergedCells.length,
    uniqueColumnNames: Array.from(allColumnNames).sort(),
    files: results
  }, null, 2));

  console.log(`\nDetailed results saved to: ${outputPath}`);
}

surveyAllFiles().catch(console.error);
