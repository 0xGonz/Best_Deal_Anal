/**
 * Cleanup temporary files created during the production architecture implementation
 */

import fs from 'fs';
import path from 'path';

const tempFiles = [
  'scripts/fix-outstanding-amount-schema.ts',
  'scripts/production-deployment-validation.ts',
  'scripts/cleanup-temp-files.ts'
];

console.log('Cleaning up temporary implementation files...');

tempFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Removed: ${file}`);
  }
});

console.log('Cleanup complete');