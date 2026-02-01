import ExcelJS from 'exceljs';
import path from 'path';

const SOURCE_DIR = 'C:\\Users\\LukeBoustridge\\Dropbox\\WSI standards and assessment\\WSC2024\\Skill Advisors\\Final MS by Skill';

async function test() {
  try {
    console.log('Testing ExcelJS...');

    const testFile = path.join(SOURCE_DIR, '01_Industrial_Mechanics_marking_scheme (f).xlsx');
    console.log('Loading:', testFile);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(testFile);

    console.log('Success! Worksheets:', workbook.worksheets.map(ws => ws.name));
    console.log('Row count:', workbook.worksheets[0]?.rowCount);

  } catch (error) {
    console.error('ERROR:', error);
  }
}

test();
