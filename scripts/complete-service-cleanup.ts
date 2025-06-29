#!/usr/bin/env tsx
/**
 * Complete Service Cleanup Script
 * 
 * Addresses the "service sprawl" issue identified in the performance audit.
 * Removes duplicate allocation services and consolidates imports to prevent confusion.
 */

import fs from 'fs';
import path from 'path';

console.log('🧹 Starting complete service cleanup...');

// Services to remove (duplicates and legacy)
const SERVICES_TO_REMOVE = [
  'allocation-calculator.ts',
  'allocation-core.service.ts',
  'allocation-creation.service.ts',
  'allocation-event-system.service.ts',
  'allocation-integrity.service.ts',
  'allocation-metrics-calculator.service.ts',
  'allocation-status.service.ts',
  'allocation-sync.service.ts',
  'auto-allocation-sync.service.ts',
  'multi-fund-allocation.service.ts',
  'optimized-allocation.service.ts',
  'production-allocation.service.ts',
  'transaction-safe-allocation.service.ts',
  'enterprise-capital-call.service.ts',
  'production-capital-calls.service.ts',
];

// Canonical services to keep
const CANONICAL_SERVICES = [
  'allocation.service.ts',         // Main allocation service
  'allocation-domain.service.ts',  // Domain service (already consolidated)
  'capital-call.service.ts',       // Main capital call service
];

interface CleanupResult {
  removed: string[];
  kept: string[];
  updated: string[];
  errors: string[];
}

class ServiceCleanup {
  private result: CleanupResult = {
    removed: [],
    kept: [],
    updated: [],
    errors: []
  };

  async run(): Promise<void> {
    try {
      // Step 1: Remove duplicate services
      await this.removeDuplicateServices();
      
      // Step 2: Update imports throughout codebase
      await this.updateImportsInRoutes();
      await this.updateImportsInServices();
      await this.updateImportsInScripts();
      
      // Step 3: Create service mapping for backward compatibility
      await this.createServiceMapping();
      
      // Step 4: Update package.json test patterns
      await this.updateTestPatterns();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Service cleanup failed:', error);
      throw error;
    }
  }

  private async removeDuplicateServices(): Promise<void> {
    console.log('\n📁 Removing duplicate services...');
    
    const servicesDir = path.join('.', 'server', 'services');
    
    for (const serviceFile of SERVICES_TO_REMOVE) {
      const servicePath = path.join(servicesDir, serviceFile);
      
      if (fs.existsSync(servicePath)) {
        try {
          // Create backup before removing
          const backupDir = path.join('.', 'storage', 'service-cleanup-backups');
          fs.mkdirSync(backupDir, { recursive: true });
          
          const backupPath = path.join(backupDir, serviceFile);
          fs.copyFileSync(servicePath, backupPath);
          
          // Remove the duplicate service
          fs.unlinkSync(servicePath);
          
          console.log(`  ✅ Removed: ${serviceFile}`);
          this.result.removed.push(serviceFile);
          
        } catch (error) {
          console.error(`  ❌ Failed to remove ${serviceFile}:`, error);
          this.result.errors.push(`Failed to remove ${serviceFile}: ${error}`);
        }
      } else {
        console.log(`  ⏭️  Already removed: ${serviceFile}`);
      }
    }
  }

  private async updateImportsInRoutes(): Promise<void> {
    console.log('\n🔄 Updating imports in routes...');
    
    const routesDir = path.join('.', 'server', 'routes');
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));
    
    for (const routeFile of routeFiles) {
      const routePath = path.join(routesDir, routeFile);
      let content = fs.readFileSync(routePath, 'utf8');
      let updated = false;
      
      // Replace problematic imports
      const importReplacements = [
        {
          old: /import.*from.*['"](\.\.\/services\/production-allocation\.service|\.\.\/services\/optimized-allocation\.service)['"]/g,
          new: "import { AllocationService } from '../services/allocation.service'"
        },
        {
          old: /import.*from.*['"](\.\.\/services\/allocation-creation\.service|\.\.\/services\/allocation-core\.service)['"]/g,
          new: "import { AllocationDomainService } from '../services/allocation-domain.service'"
        },
        {
          old: /import.*from.*['"](\.\.\/services\/enterprise-capital-call\.service|\.\.\/services\/production-capital-calls\.service)['"]/g,
          new: "import { CapitalCallService } from '../services/capital-call.service'"
        }
      ];
      
      for (const replacement of importReplacements) {
        if (replacement.old.test(content)) {
          content = content.replace(replacement.old, replacement.new);
          updated = true;
        }
      }
      
      if (updated) {
        fs.writeFileSync(routePath, content);
        console.log(`  ✅ Updated: ${routeFile}`);
        this.result.updated.push(`routes/${routeFile}`);
      }
    }
  }

  private async updateImportsInServices(): Promise<void> {
    console.log('\n🔄 Updating imports in services...');
    
    const servicesDir = path.join('.', 'server', 'services');
    const serviceFiles = fs.readdirSync(servicesDir)
      .filter(f => f.endsWith('.ts') && !SERVICES_TO_REMOVE.includes(f));
    
    for (const serviceFile of serviceFiles) {
      const servicePath = path.join(servicesDir, serviceFile);
      let content = fs.readFileSync(servicePath, 'utf8');
      let updated = false;
      
      // Replace imports of removed services
      for (const removedService of SERVICES_TO_REMOVE) {
        const serviceNameWithoutExt = removedService.replace('.ts', '');
        const importPattern = new RegExp(`import.*from.*['"].*${serviceNameWithoutExt}['"]`, 'g');
        
        if (importPattern.test(content)) {
          // Replace with canonical service import
          if (serviceNameWithoutExt.includes('allocation')) {
            content = content.replace(importPattern, "import { AllocationDomainService } from './allocation-domain.service'");
          } else if (serviceNameWithoutExt.includes('capital')) {
            content = content.replace(importPattern, "import { CapitalCallService } from './capital-call.service'");
          }
          updated = true;
        }
      }
      
      if (updated) {
        fs.writeFileSync(servicePath, content);
        console.log(`  ✅ Updated: ${serviceFile}`);
        this.result.updated.push(`services/${serviceFile}`);
      }
    }
  }

  private async updateImportsInScripts(): Promise<void> {
    console.log('\n🔄 Updating imports in scripts...');
    
    const scriptsDir = path.join('.', 'scripts');
    if (!fs.existsSync(scriptsDir)) return;
    
    const scriptFiles = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts'));
    
    for (const scriptFile of scriptFiles) {
      const scriptPath = path.join(scriptsDir, scriptFile);
      let content = fs.readFileSync(scriptPath, 'utf8');
      let updated = false;
      
      // Replace imports of removed services
      for (const removedService of SERVICES_TO_REMOVE) {
        const serviceNameWithoutExt = removedService.replace('.ts', '');
        const importPattern = new RegExp(`import.*from.*['"].*${serviceNameWithoutExt}['"]`, 'g');
        
        if (importPattern.test(content)) {
          if (serviceNameWithoutExt.includes('allocation')) {
            content = content.replace(importPattern, "import { AllocationDomainService } from '../server/services/allocation-domain.service'");
          } else if (serviceNameWithoutExt.includes('capital')) {
            content = content.replace(importPattern, "import { CapitalCallService } from '../server/services/capital-call.service'");
          }
          updated = true;
        }
      }
      
      if (updated) {
        fs.writeFileSync(scriptPath, content);
        console.log(`  ✅ Updated: scripts/${scriptFile}`);
        this.result.updated.push(`scripts/${scriptFile}`);
      }
    }
  }

  private async createServiceMapping(): Promise<void> {
    console.log('\n📋 Creating service mapping for backward compatibility...');
    
    const mappingContent = `/**
 * Service Cleanup Mapping
 * 
 * Maps old service imports to canonical services after cleanup.
 * This file ensures backward compatibility during transition.
 * 
 * Generated: ${new Date().toISOString()}
 */

// CANONICAL SERVICES (use these in new code)
export { AllocationService } from './allocation.service';
export { AllocationDomainService } from './allocation-domain.service';
export { CapitalCallService } from './capital-call.service';

// BACKWARD COMPATIBILITY ALIASES (deprecated - will be removed)
export { AllocationDomainService as ProductionAllocationService } from './allocation-domain.service';
export { AllocationDomainService as OptimizedAllocationService } from './allocation-domain.service';
export { AllocationDomainService as AllocationCreationService } from './allocation-domain.service';
export { AllocationDomainService as AllocationStatusService } from './allocation-domain.service';
export { AllocationDomainService as AllocationIntegrityService } from './allocation-domain.service';
export { AllocationDomainService as TransactionSafeAllocationService } from './allocation-domain.service';

export { CapitalCallService as EnterpriseCapitalCallService } from './capital-call.service';
export { CapitalCallService as ProductionCapitalCallService } from './capital-call.service';

// TODO: Remove these aliases in the next cleanup phase
console.warn('Using deprecated service aliases. Please update imports to use canonical services.');
`;

    const mappingPath = path.join('.', 'server', 'services', 'cleanup-mapping.ts');
    fs.writeFileSync(mappingPath, mappingContent);
    
    console.log(`  ✅ Created: cleanup-mapping.ts`);
    this.result.updated.push('services/cleanup-mapping.ts');
  }

  private async updateTestPatterns(): Promise<void> {
    console.log('\n🧪 Updating test patterns...');
    
    // Create Jest module mapping to fail on removed services
    const jestFailContent = `/**
 * Jest Test Failure Module
 * 
 * This module causes Jest to fail when importing removed services,
 * forcing developers to use canonical services.
 */

throw new Error('❌ Import Error: This service has been removed during cleanup. Please use canonical services from cleanup-mapping.ts');
`;

    const testFailDir = path.join('.', 'tests', '__fail__');
    fs.mkdirSync(testFailDir, { recursive: true });
    
    const failPath = path.join(testFailDir, 'RemovedService.js');
    fs.writeFileSync(failPath, jestFailContent);
    
    console.log(`  ✅ Created test failure module`);
  }

  private generateReport(): void {
    console.log('\n📊 SERVICE CLEANUP COMPLETE');
    console.log('===========================');
    console.log(`✅ Services removed: ${this.result.removed.length}`);
    console.log(`🔄 Files updated: ${this.result.updated.length}`);
    console.log(`⚠️  Errors: ${this.result.errors.length}`);
    
    if (this.result.removed.length > 0) {
      console.log('\n🗑️  Removed services:');
      this.result.removed.forEach(service => console.log(`   - ${service}`));
    }
    
    if (this.result.updated.length > 0) {
      console.log('\n🔄 Updated files:');
      this.result.updated.forEach(file => console.log(`   - ${file}`));
    }
    
    if (this.result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.result.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run tests to verify all imports work correctly');
    console.log('2. Update any remaining manual imports in client code');
    console.log('3. Remove backup files after verification');
    console.log('4. Consider removing cleanup-mapping.ts aliases in future cleanup');
    
    console.log('\n✨ Service sprawl eliminated - developers will now use canonical services!');
  }
}

async function main() {
  try {
    const cleanup = new ServiceCleanup();
    await cleanup.run();
  } catch (error) {
    console.error('💥 Service cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup immediately
main();