#!/usr/bin/env tsx
/**
 * Remove unused React imports and other unused imports
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function removeUnusedImports(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf8');
    let modified = false;
    let lines = content.split('\n');

    // Remove unused React imports (Vite handles JSX transform)
    lines = lines.map(line => {
      if (line.trim().startsWith('import React') && 
          !content.includes('React.') && 
          !content.includes('React ')) {
        modified = true;
        return '';
      }
      return line;
    });

    // Remove empty import lines
    lines = lines.filter((line, index) => {
      if (line.trim() === '' && 
          index > 0 && 
          lines[index - 1].trim().startsWith('import') &&
          index < lines.length - 1 &&
          lines[index + 1].trim().startsWith('import')) {
        return false;
      }
      return true;
    });

    if (modified) {
      const finalContent = lines.join('\n');
      writeFileSync(filePath, finalContent, 'utf8');
      console.log(`✅ Removed unused imports from: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.warn(`⚠️  Could not process ${filePath}: ${error}`);
    return false;
  }
}

function getAllTSFiles(dir: string, files: string[] = []): string[] {
  const excludedDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      
      if (excludedDirs.some(excluded => fullPath.includes(excluded))) {
        continue;
      }
      
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        getAllTSFiles(fullPath, files);
      } else if (['.ts', '.tsx'].includes(extname(fullPath))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return files;
}

async function main() {
  console.log('🧹 Removing unused imports...\n');
  
  const allFiles = getAllTSFiles('client/src');
  let cleanedCount = 0;
  
  for (const file of allFiles) {
    if (removeUnusedImports(file)) {
      cleanedCount++;
    }
  }
  
  console.log(`\n✨ Import cleanup complete! Processed ${allFiles.length} files, cleaned ${cleanedCount} files.`);
}

main().catch(console.error);