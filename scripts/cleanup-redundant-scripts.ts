#!/usr/bin/env tsx
/**
 * Cleanup script to remove redundant status-fixing scripts
 * and implement consolidated status enum handling
 */

import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const REDUNDANT_SCRIPTS = [
  'scripts/fix-allocation-status-workflow.ts',
  'scripts/fix-allocation-status-enum.ts',
  'scripts/validate-allocation-status-consistency.ts',
  'scripts/fix-funded-allocation-data.ts'
];

async function cleanupRedundantScripts() {
  console.log('🧹 Cleaning up redundant status-fixing scripts...');
  
  for (const scriptPath of REDUNDANT_SCRIPTS) {
    if (existsSync(scriptPath)) {
      try {
        await unlink(scriptPath);
        console.log(`✅ Removed: ${scriptPath}`);
      } catch (error) {
        console.error(`❌ Failed to remove ${scriptPath}:`, error);
      }
    } else {
      console.log(`ℹ️  Already removed: ${scriptPath}`);
    }
  }
  
  console.log('✅ Script cleanup completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupRedundantScripts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}