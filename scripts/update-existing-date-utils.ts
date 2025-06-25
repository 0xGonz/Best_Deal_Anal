/**
 * Update Existing Date Utilities
 * 
 * Remove duplicate date utilities and update imports to use the consolidated version
 */

import { promises as fs } from 'fs';
import { join } from 'path';

async function updateDateUtilsImports() {
  console.log('🔧 Updating date utilities imports...\n');

  // Files that might import date utilities
  const filesToCheck = [
    'server/utils/date-utils.ts',
    'utils/date-utils.ts',
    'client/src/utils/date-utils.ts'
  ];

  const rootDir = process.cwd();

  for (const filePath of filesToCheck) {
    const fullPath = join(rootDir, filePath);
    
    try {
      await fs.access(fullPath);
      
      // Check if file exists and remove it if it's a duplicate
      const content = await fs.readFile(fullPath, 'utf-8');
      
      if (content.includes('normalizeToNoonUTC')) {
        console.log(`Found duplicate date utilities in: ${filePath}`);
        
        // Create backup
        await fs.writeFile(`${fullPath}.backup`, content);
        
        // Remove the duplicate file
        await fs.unlink(fullPath);
        
        console.log(`✅ Removed duplicate file: ${filePath}`);
        console.log(`   Backup created at: ${filePath}.backup`);
      }
    } catch (error) {
      // File doesn't exist, which is fine
      continue;
    }
  }

  // Update imports in service files
  const serviceFiles = [
    'server/services/capital-call.service.ts',
    'server/services/allocation.service.ts',
    'server/services/multi-fund-allocation.service.ts'
  ];

  for (const serviceFile of serviceFiles) {
    const fullPath = join(rootDir, serviceFile);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Update import paths to use the consolidated utilities
      const updatedContent = content
        .replace(/from ['"]\.\.\/utils\/date-utils['"]/g, "from '@shared/utils/date-utils'")
        .replace(/from ['"]\.\.\/\.\.\/utils\/date-utils['"]/g, "from '@shared/utils/date-utils'");
      
      if (content !== updatedContent) {
        await fs.writeFile(fullPath, updatedContent);
        console.log(`✅ Updated imports in: ${serviceFile}`);
      }
    } catch (error) {
      // File doesn't exist or can't be read
      continue;
    }
  }

  console.log('\n🎉 Date utilities consolidation complete!');
}

// Run the update
updateDateUtilsImports().catch(console.error);