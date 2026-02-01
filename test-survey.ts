import fs from 'fs/promises';
import path from 'path';

const SOURCE_DIR = 'C:\\Users\\LukeBoustridge\\Dropbox\\WSI standards and assessment\\WSC2024\\Skill Advisors\\Final MS by Skill';

async function test() {
  try {
    console.log('Testing directory access...');
    console.log('Source dir:', SOURCE_DIR);

    const files = await fs.readdir(SOURCE_DIR);
    const xlsxFiles = files.filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));

    console.log(`Found ${xlsxFiles.length} Excel files`);
    console.log('First 5 files:');
    xlsxFiles.slice(0, 5).forEach(f => console.log('  -', f));

  } catch (error) {
    console.error('ERROR:', error);
  }
}

test();
