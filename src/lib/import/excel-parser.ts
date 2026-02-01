import ExcelJS from 'exceljs';
import { normalizeDescriptorText, detectEncodingIssues, extractSkillNameFromFilename } from './text-normalizer';

export interface ParsedDescriptor {
  code: string;
  criterionName: string;
  excellent: string;
  good: string;
  pass: string;
  belowPass: string;
  category?: string;
  skillName: string;
  warnings: string[];
}

export interface ParserConfig {
  sheetName?: string;
  headerRow: number;
  columns: {
    code: number | string[];      // Column index or possible header names
    criterionName: number | string[];
    excellent: number | string[];
    good: number | string[];
    pass: number | string[];
    belowPass: number | string[];
    category?: number | string[];
  };
}

// Default config based on survey results - adjust after running survey
const DEFAULT_COLUMN_PATTERNS = {
  code: ['code', 'id', 'ref', 'no', 'number', 'aspect'],
  criterionName: ['criterion', 'criteria', 'descriptor', 'description', 'aspect', 'sub-aspect', 'sub aspect'],
  excellent: ['excellent', 'exc', 'outstanding', '4', 'four'],
  good: ['good', 'satisfactory', '3', 'three'],
  pass: ['pass', 'acceptable', 'adequate', '2', 'two', 'sufficient'],
  belowPass: ['below', 'poor', 'unsatisfactory', 'fail', '1', 'one', 'insufficient', 'below pass']
};

/**
 * Finds column index by matching header names against patterns.
 */
function findColumnIndex(
  columns: { name: string; index: number }[],
  patterns: string[]
): number | undefined {
  for (const col of columns) {
    const name = col.name.toLowerCase().trim();
    for (const pattern of patterns) {
      if (name.includes(pattern.toLowerCase())) {
        return col.index;
      }
    }
  }
  return undefined;
}

/**
 * Gets cell text value, handling merged cells correctly.
 */
function getCellText(row: ExcelJS.Row, colNumber: number, sheet: ExcelJS.Worksheet): string {
  const cell = row.getCell(colNumber);

  // Handle merged cells - get master cell value
  if (cell.isMerged && cell.master) {
    return cell.master.text || '';
  }

  // Handle different cell value types
  if (cell.value === null || cell.value === undefined) {
    return '';
  }

  // Rich text
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    return (cell.value.richText as { text: string }[]).map(r => r.text).join('');
  }

  return cell.text || String(cell.value);
}

/**
 * Detects header row and extracts column information.
 */
function detectHeaderAndColumns(sheet: ExcelJS.Worksheet): {
  headerRow: number;
  columns: { name: string; index: number }[];
} {
  let headerRow = 1;
  const columns: { name: string; index: number }[] = [];

  // Find header row (first row with multiple non-empty cells that look like headers)
  for (let i = 1; i <= Math.min(20, sheet.rowCount); i++) {
    const row = sheet.getRow(i);
    const cells: { name: string; index: number }[] = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = getCellText(row, colNumber, sheet).toLowerCase();
      cells.push({ name: getCellText(row, colNumber, sheet), index: colNumber });
    });

    // Check if this looks like a header row (has multiple cells, contains descriptor-related terms)
    if (cells.length >= 3) {
      const headerTerms = ['criterion', 'descriptor', 'excellent', 'good', 'pass', 'code', 'aspect'];
      const hasHeaderTerms = cells.some(c =>
        headerTerms.some(term => c.name.toLowerCase().includes(term))
      );

      if (hasHeaderTerms) {
        headerRow = i;
        columns.push(...cells);
        break;
      }
    }
  }

  // Fallback: use first row with 3+ cells
  if (columns.length === 0) {
    for (let i = 1; i <= Math.min(10, sheet.rowCount); i++) {
      const row = sheet.getRow(i);
      const cells: { name: string; index: number }[] = [];

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cells.push({ name: getCellText(row, colNumber, sheet), index: colNumber });
      });

      if (cells.length >= 3) {
        headerRow = i;
        columns.push(...cells);
        break;
      }
    }
  }

  return { headerRow, columns };
}

/**
 * Parses a single marking scheme file.
 */
export async function parseMarkingScheme(filePath: string): Promise<{
  descriptors: ParsedDescriptor[];
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const descriptors: ParsedDescriptor[] = [];

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Find the appropriate sheet
    let sheet = workbook.getWorksheet('Marking Scheme')
      || workbook.getWorksheet('MS')
      || workbook.worksheets.find(ws =>
          ws.name.toLowerCase().includes('mark') ||
          ws.name.toLowerCase().includes('criteria')
        )
      || workbook.worksheets[0];

    if (!sheet) {
      errors.push('No worksheet found');
      return { descriptors, errors, warnings };
    }

    // Detect header and columns
    const { headerRow, columns } = detectHeaderAndColumns(sheet);

    if (columns.length === 0) {
      errors.push('Could not detect header row');
      return { descriptors, errors, warnings };
    }

    // Map columns to descriptor fields
    const colMapping = {
      code: findColumnIndex(columns, DEFAULT_COLUMN_PATTERNS.code),
      criterionName: findColumnIndex(columns, DEFAULT_COLUMN_PATTERNS.criterionName),
      excellent: findColumnIndex(columns, DEFAULT_COLUMN_PATTERNS.excellent),
      good: findColumnIndex(columns, DEFAULT_COLUMN_PATTERNS.good),
      pass: findColumnIndex(columns, DEFAULT_COLUMN_PATTERNS.pass),
      belowPass: findColumnIndex(columns, DEFAULT_COLUMN_PATTERNS.belowPass),
      category: findColumnIndex(columns, ['category', 'section', 'module', 'area'])
    };

    // Validate required columns found
    if (!colMapping.criterionName && !colMapping.code) {
      errors.push(`Could not find criterion/code columns. Found: ${columns.map(c => c.name).join(', ')}`);
      return { descriptors, errors, warnings };
    }

    // Extract skill name from filename
    const filename = filePath.split(/[/\\]/).pop() || '';
    const skillName = extractSkillNameFromFilename(filename);

    // Track current category (for merged cells)
    let currentCategory = '';

    // Parse data rows
    sheet.eachRow((row, rowNumber) => {
      // Skip header and empty rows
      if (rowNumber <= headerRow) return;

      // Check for category row (often in merged cell spanning columns)
      if (colMapping.category) {
        const categoryText = getCellText(row, colMapping.category, sheet);
        if (categoryText && categoryText.length > 0 && categoryText.length < 100) {
          currentCategory = normalizeDescriptorText(categoryText);
        }
      }

      // Get criterion name (required)
      const criterionCol = colMapping.criterionName || colMapping.code;
      if (!criterionCol) return;

      const criterionName = normalizeDescriptorText(getCellText(row, criterionCol, sheet));
      if (!criterionName || criterionName.length < 2) return;

      // Get code (use row number if not available)
      let code = colMapping.code
        ? normalizeDescriptorText(getCellText(row, colMapping.code, sheet))
        : '';

      if (!code) {
        code = `R${rowNumber}`;
      }

      // Get performance levels
      const excellent = colMapping.excellent
        ? normalizeDescriptorText(getCellText(row, colMapping.excellent, sheet))
        : '';
      const good = colMapping.good
        ? normalizeDescriptorText(getCellText(row, colMapping.good, sheet))
        : '';
      const pass = colMapping.pass
        ? normalizeDescriptorText(getCellText(row, colMapping.pass, sheet))
        : '';
      const belowPass = colMapping.belowPass
        ? normalizeDescriptorText(getCellText(row, colMapping.belowPass, sheet))
        : '';

      // Collect warnings
      const rowWarnings: string[] = [];
      [criterionName, excellent, good, pass, belowPass].forEach(text => {
        rowWarnings.push(...detectEncodingIssues(text));
      });

      // Only add if we have meaningful content
      if (criterionName.length >= 5 || excellent || good || pass || belowPass) {
        descriptors.push({
          code,
          criterionName,
          excellent,
          good,
          pass,
          belowPass,
          category: currentCategory || undefined,
          skillName,
          warnings: rowWarnings
        });
      }
    });

    if (descriptors.length === 0) {
      warnings.push('No descriptors extracted from file');
    }

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { descriptors, errors, warnings };
}
