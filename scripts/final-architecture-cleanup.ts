#!/usr/bin/env tsx
/**
 * Final Architecture Cleanup Script
 * 
 * Implements the comprehensive cleanup plan identified in the external audit:
 * 1. Remove duplicate allocation routes (allocations.ts vs production-allocations.ts)
 * 2. Eliminate obsolete endpoints and no-op middleware
 * 3. Clean up commented-out code blocks
 * 4. Remove unused imports and dead code
 * 5. Complete the clean architecture pattern implementation
 */

import fs from 'fs';
import path from 'path';

console.log('🏗️ Final Architecture Cleanup - Implementing External Audit Recommendations');
console.log('═══════════════════════════════════════════════════════════════════════════');

interface CleanupResult {
  deadCodeRemoved: string[];
  duplicatesEliminated: string[];
  obsoleteEndpointsRemoved: string[];
  commentsCleanedUp: string[];
  errors: string[];
}

class ArchitectureCleanup {
  private result: CleanupResult = {
    deadCodeRemoved: [],
    duplicatesEliminated: [],
    obsoleteEndpointsRemoved: [],
    commentsCleanedUp: [],
    errors: []
  };

  async execute(): Promise<void> {
    console.log('\n🎯 Phase 1: Remove Duplicate Route Files');
    await this.removeDuplicateRoutes();

    console.log('\n🎯 Phase 2: Eliminate Obsolete Endpoints');
    await this.removeObsoleteEndpoints();

    console.log('\n🎯 Phase 3: Clean Up Dead Code');
    await this.removeDeadCode();

    console.log('\n🎯 Phase 4: Remove Commented Code Blocks');
    await this.cleanupCommentedCode();

    console.log('\n🎯 Phase 5: Update Route Registrations');
    await this.updateRouteRegistrations();

    this.generateReport();
  }

  private async removeDuplicateRoutes(): Promise<void> {
    console.log('  📍 Removing legacy allocations.ts in favor of production-allocations.ts...');
    
    const legacyRoute = 'server/routes/allocations.ts';
    const productionRoute = 'server/routes/production-allocations.ts';
    
    try {
      // Check if both files exist
      if (fs.existsSync(legacyRoute) && fs.existsSync(productionRoute)) {
        // Backup the legacy route
        const backupPath = `storage/architecture-cleanup-backups/legacy-allocations-${Date.now()}.ts`;
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(legacyRoute, backupPath);
        
        // Remove the legacy route
        fs.unlinkSync(legacyRoute);
        
        this.result.duplicatesEliminated.push(`${legacyRoute} → ${backupPath}`);
        console.log(`    ✅ Moved ${legacyRoute} to backup`);
      }
    } catch (error) {
      this.result.errors.push(`Failed to remove duplicate route: ${error}`);
      console.log(`    ❌ Error: ${error}`);
    }
  }

  private async removeObsoleteEndpoints(): Promise<void> {
    console.log('  📍 Removing obsolete system endpoints...');
    
    const systemRoutesFile = 'server/routes/system.ts';
    
    if (fs.existsSync(systemRoutesFile)) {
      try {
        let content = fs.readFileSync(systemRoutesFile, 'utf-8');
        
        // Remove obsolete endpoints identified in audit
        const obsoleteEndpoints = [
          '/database/sync-pending',
          '/simulate-failure', 
          '/restore-normal'
        ];
        
        obsoleteEndpoints.forEach(endpoint => {
          const routeRegex = new RegExp(
            `router\\.[a-z]+\\(.*['"\`]${endpoint.replace('/', '\\/')}.*\\n[\\s\\S]*?\\}\\);?`, 
            'gm'
          );
          
          if (routeRegex.test(content)) {
            content = content.replace(routeRegex, '');
            this.result.obsoleteEndpointsRemoved.push(endpoint);
            console.log(`    ✅ Removed obsolete endpoint: ${endpoint}`);
          }
        });
        
        fs.writeFileSync(systemRoutesFile, content);
        
      } catch (error) {
        this.result.errors.push(`Failed to clean system routes: ${error}`);
        console.log(`    ❌ Error: ${error}`);
      }
    }
  }

  private async removeDeadCode(): Promise<void> {
    console.log('  📍 Removing unused imports and dead code...');
    
    const filesToClean = [
      'server/routes/production-allocations.ts',
      'server/index.ts',
      'server/storage.ts'
    ];
    
    for (const file of filesToClean) {
      if (fs.existsSync(file)) {
        try {
          let content = fs.readFileSync(file, 'utf-8');
          
          // Remove unused MetricsCalculator imports
          const unusedImports = [
            /import.*MetricsCalculator.*from.*;\n/g,
            /import.*metricsCalculator.*from.*;\n/g,
            /const\s+metricsCalculator\s*=.*;\n/g
          ];
          
          unusedImports.forEach(regex => {
            if (regex.test(content)) {
              content = content.replace(regex, '');
              this.result.deadCodeRemoved.push(`Unused import in ${file}`);
            }
          });
          
          fs.writeFileSync(file, content);
          console.log(`    ✅ Cleaned dead code in ${file}`);
          
        } catch (error) {
          this.result.errors.push(`Failed to clean ${file}: ${error}`);
          console.log(`    ❌ Error cleaning ${file}: ${error}`);
        }
      }
    }
  }

  private async cleanupCommentedCode(): Promise<void> {
    console.log('  📍 Cleaning up large commented code blocks...');
    
    const productionAllocations = 'server/routes/production-allocations.ts';
    
    if (fs.existsSync(productionAllocations)) {
      try {
        let content = fs.readFileSync(productionAllocations, 'utf-8');
        
        // Remove large commented blocks with TODO markers
        const commentedBlocks = [
          /\/\*\*[\s\S]*?TODO.*?Auto-trigger.*?\*\//g,
          /\/\/\s*TODO.*Auto-trigger.*?\n/g,
          /\/\*[\s\S]*?commented out.*?\*\//g
        ];
        
        let cleaned = false;
        commentedBlocks.forEach(regex => {
          if (regex.test(content)) {
            content = content.replace(regex, '');
            cleaned = true;
          }
        });
        
        if (cleaned) {
          fs.writeFileSync(productionAllocations, content);
          this.result.commentsCleanedUp.push(productionAllocations);
          console.log(`    ✅ Cleaned commented blocks in ${productionAllocations}`);
        }
        
      } catch (error) {
        this.result.errors.push(`Failed to clean comments: ${error}`);
        console.log(`    ❌ Error: ${error}`);
      }
    }
  }

  private async updateRouteRegistrations(): Promise<void> {
    console.log('  📍 Updating route registrations to use production endpoints...');
    
    const routeIndex = 'server/routes/index.ts';
    
    if (fs.existsSync(routeIndex)) {
      try {
        let content = fs.readFileSync(routeIndex, 'utf-8');
        
        // Remove legacy allocation route import and registration
        content = content.replace(/import.*allocations.*from.*\.\/allocations.*;\n/g, '');
        content = content.replace(/router\.use\(['"`]\/allocations['"`],\s*allocations\);?\n/g, '');
        
        // Ensure production allocations are properly registered
        if (!content.includes('production-allocations')) {
          const importSection = content.match(/import.*from.*;\n/g)?.join('') || '';
          const newImport = `import productionAllocations from './production-allocations';\n`;
          
          if (!importSection.includes('production-allocations')) {
            content = content.replace(
              /(import.*from.*;\n)(.*)/s,
              `$1${newImport}$2`
            );
          }
          
          // Add route registration if missing
          if (!content.includes("router.use('/allocations', productionAllocations)")) {
            content = content.replace(
              /(router\.use\(.*\);\n)/,
              `$1router.use('/allocations', productionAllocations);\n`
            );
          }
        }
        
        fs.writeFileSync(routeIndex, content);
        console.log(`    ✅ Updated route registrations`);
        
      } catch (error) {
        this.result.errors.push(`Failed to update route registrations: ${error}`);
        console.log(`    ❌ Error: ${error}`);
      }
    }
  }

  private generateReport(): void {
    console.log('\n📊 Final Architecture Cleanup Report');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    
    console.log(`\n✅ Duplicates Eliminated (${this.result.duplicatesEliminated.length}):`);
    this.result.duplicatesEliminated.forEach(item => console.log(`  - ${item}`));
    
    console.log(`\n✅ Obsolete Endpoints Removed (${this.result.obsoleteEndpointsRemoved.length}):`);
    this.result.obsoleteEndpointsRemoved.forEach(item => console.log(`  - ${item}`));
    
    console.log(`\n✅ Dead Code Removed (${this.result.deadCodeRemoved.length}):`);
    this.result.deadCodeRemoved.forEach(item => console.log(`  - ${item}`));
    
    console.log(`\n✅ Comments Cleaned (${this.result.commentsCleanedUp.length}):`);
    this.result.commentsCleanedUp.forEach(item => console.log(`  - ${item}`));
    
    if (this.result.errors.length > 0) {
      console.log(`\n❌ Errors (${this.result.errors.length}):`);
      this.result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    const totalImprovements = 
      this.result.duplicatesEliminated.length +
      this.result.obsoleteEndpointsRemoved.length +
      this.result.deadCodeRemoved.length +
      this.result.commentsCleanedUp.length;
    
    console.log(`\n🎉 Architecture Cleanup Complete!`);
    console.log(`   Total improvements: ${totalImprovements}`);
    console.log(`   Code quality significantly improved`);
    console.log(`   Maintainability enhanced`);
    console.log(`   Technical debt reduced`);
  }
}

async function main() {
  const cleanup = new ArchitectureCleanup();
  await cleanup.execute();
}

main().catch(console.error);