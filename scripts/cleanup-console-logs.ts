#!/usr/bin/env tsx
/**
 * Console.log cleanup script - removes all console statements for production
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function cleanupConsoleStatements(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    
    const cleanedLines = lines.map((line, index) => {
      // Remove complete console.log lines
      if (line.trim().match(/^\s*console\.(log|debug|info|warn)\(/)) {
        modified = true;
        return ''; // Remove the line entirely
      }
      
      // Remove console.error in production code (keep only in error handling)
      if (line.trim().match(/^\s*console\.error\(/) && !line.includes('catch') && !line.includes('onError')) {
        modified = true;
        return '';
      }
      
      return line;
    });
    
    if (modified) {
      // Remove empty lines that were created by removing console statements
      const finalContent = cleanedLines
        .map(line => line === '' ? '' : line)
        .join('\n')
        .replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace multiple empty lines with single
      
      writeFileSync(filePath, finalContent, 'utf8');
      console.log(`✅ Cleaned console statements from: ${filePath}`);
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
      } else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(fullPath))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return files;
}

async function main() {
  console.log('🧹 Starting console.log cleanup...\n');
  
  const allFiles = getAllTSFiles('.');
  const frontendFiles = allFiles.filter(f => f.includes('client/src'));
  
  let cleanedCount = 0;
  
  for (const file of frontendFiles) {
    if (cleanupConsoleStatements(file)) {
      cleanedCount++;
    }
  }
  
  console.log(`\n✨ Cleanup complete! Processed ${frontendFiles.length} files, cleaned ${cleanedCount} files.`);
}

main().catch(console.error);