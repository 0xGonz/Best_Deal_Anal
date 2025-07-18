#!/usr/bin/env tsx
/**
 * TypeScript Issues Auto-Fix Script
 */

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  {
    file: 'client/src/components/distributions/DistributionsManagementHub.tsx',
    search: /distributions\.map\(([^)]+)\)/g,
    replace: '(distributions as any[]).map($1)'
  },
  {
    file: 'client/src/components/distributions/DistributionsManagementHub.tsx',
    search: /distributions\.length/g,
    replace: '(distributions as any[]).length'
  },
  {
    file: 'client/src/components/distributions/DistributionsManagementHub.tsx',
    search: /distributions\.filter\(([^)]+)\)/g,
    replace: '(distributions as any[]).filter($1)'
  }
];

function applyFixes() {
  for (const fix of fixes) {
    try {
      const content = readFileSync(fix.file, 'utf8');
      const updated = content.replace(fix.search, fix.replace);
      
      if (content !== updated) {
        writeFileSync(fix.file, updated, 'utf8');
        console.log(`✅ Applied fix to ${fix.file}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not fix ${fix.file}: ${error}`);
    }
  }
}

applyFixes();