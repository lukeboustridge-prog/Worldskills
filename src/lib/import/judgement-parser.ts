import * as ExcelJS from 'exceljs';
import { normalizeDescriptorText, extractSkillNameFromFilename } from './text-normalizer';

export interface JudgementDescriptor {
  code: string;
  criterionName: string;
  category: string;
  level0: string; // Below Pass (0 points)
  level1: string; // Pass (1 point)
  level2: string; // Good (2 points)
  level3: string; // Excellent (3 points)
  skillName: string;
  warnings: string[];
}

interface ColumnMapping {
  subCriterionId: number;      // Column A - "A1", "A2" etc
  subCriterionName: number;    // Column B - Category/Section name
  aspectType: number;          // Column D - "M" or "J"
  aspectDescription: number;   // Column E - Criterion name for J rows
  judgeScore: number;          // Column F - 0, 1, 2, 3
  levelDescription: number;    // Column G - Level description text
}

function getCellText(row: ExcelJS.Row, colNumber: number): string {
  try {
    const cell = row.getCell(colNumber);
    if (cell.isMerged && cell.master) {
      return cell.master.text || cell.master.value?.toString() || '';
    }
    return cell.text || cell.value?.toString() || '';
  } catch {
    return '';
  }
}

/**
 * Parses judgement marking descriptors from CIS Marking Scheme Import files.
 *
 * Structure:
 * - Row with Type="J" defines the criterion
 * - Following 4 rows contain scores 0-3 with level descriptions
 */
export async function parseJudgementDescriptors(filePath: string): Promise<{
  descriptors: JudgementDescriptor[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    judgementCriteria: number;
    measurementCriteria: number;
  };
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const descriptors: JudgementDescriptor[] = [];
  const stats = { totalRows: 0, judgementCriteria: 0, measurementCriteria: 0 };

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.getWorksheet('CIS Marking Scheme Import');
    if (!sheet) {
      errors.push('No "CIS Marking Scheme Import" worksheet found');
      return { descriptors, errors, warnings, stats };
    }

    stats.totalRows = sheet.rowCount;

    // Column mapping based on standard CIS import format
    const cols: ColumnMapping = {
      subCriterionId: 1,      // Column A
      subCriterionName: 2,    // Column B
      aspectType: 4,          // Column D
      aspectDescription: 5,   // Column E
      judgeScore: 6,          // Column F
      levelDescription: 7,    // Column G
    };

    // Extract skill name from filename
    const filename = filePath.split(/[/\\]/).pop() || '';
    const skillName = extractSkillNameFromFilename(filename);

    // Track current category/section
    let currentCategory = '';
    let currentCriterionId = '';

    // Process rows
    let i = 1;
    while (i <= sheet.rowCount) {
      const row = sheet.getRow(i);

      // Check for category/section row (has ID like "A1", "A2")
      const subCriterionId = getCellText(row, cols.subCriterionId).trim();
      if (subCriterionId.match(/^[A-Z]\d+$/i)) {
        currentCriterionId = subCriterionId;
        const categoryName = getCellText(row, cols.subCriterionName).trim();
        if (categoryName) {
          currentCategory = normalizeDescriptorText(categoryName);
        }
        i++;
        continue;
      }

      // Check for aspect type
      const aspectType = getCellText(row, cols.aspectType).trim().toUpperCase();

      if (aspectType === 'M') {
        stats.measurementCriteria++;
        i++;
        continue;
      }

      if (aspectType === 'J') {
        stats.judgementCriteria++;

        // This is a judgement criterion row
        const criterionName = normalizeDescriptorText(getCellText(row, cols.aspectDescription));

        if (!criterionName || criterionName.length < 3) {
          i++;
          continue;
        }

        // Collect the 4 level descriptions from following rows
        const levels: Record<string, string> = {};
        const descriptorWarnings: string[] = [];

        for (let offset = 1; offset <= 4; offset++) {
          const levelRow = sheet.getRow(i + offset);
          if (!levelRow) break;

          const scoreText = getCellText(levelRow, cols.judgeScore).trim();
          const description = normalizeDescriptorText(getCellText(levelRow, cols.levelDescription));

          // Parse score (0, 1, 2, or 3)
          const score = parseInt(scoreText, 10);
          if (score >= 0 && score <= 3 && description) {
            levels[`level${score}`] = description;
          }
        }

        // Only add if we have at least some level descriptions
        const levelCount = Object.keys(levels).length;
        if (levelCount === 0) {
          warnings.push(`No level descriptions found for "${criterionName}" at row ${i}`);
          i++;
          continue;
        }

        if (levelCount < 4) {
          descriptorWarnings.push(`Only ${levelCount}/4 levels found`);
        }

        // Generate a unique code
        const code = currentCriterionId
          ? `${currentCriterionId}-${stats.judgementCriteria}`
          : `J${stats.judgementCriteria}`;

        descriptors.push({
          code,
          criterionName,
          category: currentCategory,
          level0: levels.level0 || '',
          level1: levels.level1 || '',
          level2: levels.level2 || '',
          level3: levels.level3 || '',
          skillName,
          warnings: descriptorWarnings,
        });

        // Skip past the level description rows
        i += 5;
        continue;
      }

      i++;
    }

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { descriptors, errors, warnings, stats };
}
