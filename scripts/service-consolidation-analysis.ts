/**
 * Service Consolidation Analysis Phase 1.3
 * 
 * Analyzes service proliferation and prepares consolidation strategy
 * Identifies overlapping services and creates domain boundaries
 */

import fs from 'fs';
import path from 'path';

interface ServiceAnalysis {
  fileName: string;
  category: string;
  lineCount: number;
  dependencies: string[];
  exports: string[];
  complexity: 'low' | 'medium' | 'high';
  consolidationTarget?: string;
}

class ServiceConsolidationAnalyzer {
  private services: ServiceAnalysis[] = [];
  private domains = new Map<string, string[]>();

  async analyzeServiceArchitecture(): Promise<void> {
    console.log('🔍 Analyzing service architecture...');
    
    await this.scanServiceFiles();
    this.categorizeServices();
    this.identifyConsolidationOpportunities();
    this.generateConsolidationPlan();
  }

  private async scanServiceFiles(): Promise<void> {
    const serviceDir = 'server/services';
    const routesDir = 'server/routes';
    
    // Scan service files
    if (fs.existsSync(serviceDir)) {
      const serviceFiles = fs.readdirSync(serviceDir)
        .filter(f => f.endsWith('.ts') && f !== 'index.ts');
      
      for (const file of serviceFiles) {
        await this.analyzeFile(path.join(serviceDir, file), 'service');
      }
    }
    
    // Scan route files
    if (fs.existsSync(routesDir)) {
      const routeFiles = fs.readdirSync(routesDir)
        .filter(f => f.endsWith('.ts') && f !== 'index.ts');
      
      for (const file of routeFiles) {
        await this.analyzeFile(path.join(routesDir, file), 'route');
      }
    }
    
    console.log(`📊 Analyzed ${this.services.length} service/route files`);
  }

  private async analyzeFile(filePath: string, category: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Extract imports (dependencies)
      const dependencies = lines
        .filter(line => line.trim().startsWith('import'))
        .map(line => {
          const match = line.match(/from\s+['"]([^'"]+)['"]/);
          return match ? match[1] : '';
        })
        .filter(dep => dep.length > 0);
      
      // Extract exports
      const exports = lines
        .filter(line => line.includes('export'))
        .map(line => {
          const match = line.match(/export\s+(?:class|function|const)\s+(\w+)/);
          return match ? match[1] : '';
        })
        .filter(exp => exp.length > 0);
      
      // Determine complexity based on line count and patterns
      let complexity: 'low' | 'medium' | 'high' = 'low';
      if (lines.length > 200) complexity = 'high';
      else if (lines.length > 100) complexity = 'medium';
      
      // Check for complexity indicators
      const hasAsync = content.includes('async ');
      const hasDatabase = content.includes('storage') || content.includes('pool.query');
      const hasValidation = content.includes('zod') || content.includes('validate');
      
      if (hasAsync && hasDatabase && hasValidation) complexity = 'high';
      
      this.services.push({
        fileName: path.basename(filePath),
        category,
        lineCount: lines.length,
        dependencies,
        exports,
        complexity
      });
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error);
    }
  }

  private categorizeServices(): void {
    // Group services by domain
    const allocationServices = this.services.filter(s => 
      s.fileName.includes('allocation') || s.fileName.includes('capital')
    );
    
    const dealServices = this.services.filter(s => 
      s.fileName.includes('deal') || s.fileName.includes('investment')
    );
    
    const fundServices = this.services.filter(s => 
      s.fileName.includes('fund')
    );
    
    const documentServices = this.services.filter(s => 
      s.fileName.includes('document') || s.fileName.includes('upload')
    );
    
    const authServices = this.services.filter(s => 
      s.fileName.includes('auth') || s.fileName.includes('user')
    );
    
    const utilityServices = this.services.filter(s => 
      s.fileName.includes('util') || s.fileName.includes('helper') || 
      s.fileName.includes('base') || s.fileName.includes('common')
    );
    
    this.domains.set('Allocation Management', allocationServices.map(s => s.fileName));
    this.domains.set('Deal Pipeline', dealServices.map(s => s.fileName));
    this.domains.set('Fund Administration', fundServices.map(s => s.fileName));
    this.domains.set('Document Management', documentServices.map(s => s.fileName));
    this.domains.set('Authentication', authServices.map(s => s.fileName));
    this.domains.set('Utilities', utilityServices.map(s => s.fileName));
    
    console.log('\n📋 Service categorization:');
    this.domains.forEach((services, domain) => {
      if (services.length > 0) {
        console.log(`  ${domain}: ${services.length} services`);
        services.forEach(service => console.log(`    - ${service}`));
      }
    });
  }

  private identifyConsolidationOpportunities(): void {
    console.log('\n🎯 Consolidation opportunities:');
    
    // Identify services that can be merged
    const allocationServices = this.services.filter(s => 
      s.fileName.includes('allocation') || s.fileName.includes('capital')
    );
    
    if (allocationServices.length > 2) {
      console.log(`  📍 HIGH PRIORITY: ${allocationServices.length} allocation-related services can be consolidated`);
      allocationServices.forEach(service => {
        service.consolidationTarget = 'AllocationDomainService';
      });
    }
    
    // Identify duplicate functionality
    const duplicatePatterns = new Map<string, string[]>();
    
    this.services.forEach(service => {
      service.exports.forEach(exp => {
        if (!duplicatePatterns.has(exp)) {
          duplicatePatterns.set(exp, []);
        }
        duplicatePatterns.get(exp)!.push(service.fileName);
      });
    });
    
    duplicatePatterns.forEach((files, exportName) => {
      if (files.length > 1) {
        console.log(`  ⚠️  Potential duplicate: '${exportName}' exported by ${files.join(', ')}`);
      }
    });
    
    // Identify complexity hotspots
    const complexServices = this.services.filter(s => s.complexity === 'high');
    console.log(`\n🔥 High complexity services (${complexServices.length}):`);
    complexServices.forEach(service => {
      console.log(`  - ${service.fileName} (${service.lineCount} lines)`);
    });
  }

  private generateConsolidationPlan(): void {
    console.log('\n📝 Service Consolidation Plan:');
    console.log('=================================');
    
    console.log('\nPhase 2.1: Critical Domain Consolidation');
    console.log('- Merge allocation-related services into AllocationDomainService');
    console.log('- Consolidate capital call logic into single module');
    console.log('- Create unified fund administration service');
    
    console.log('\nPhase 2.2: Service Interface Standardization');
    console.log('- Implement consistent service interface patterns');
    console.log('- Remove duplicate functionality across services');
    console.log('- Establish clear domain boundaries');
    
    console.log('\nPhase 2.3: Performance Optimization');
    console.log('- Reduce inter-service dependencies');
    console.log('- Implement service-level caching');
    console.log('- Optimize database access patterns');
    
    // Calculate metrics
    const totalServices = this.services.length;
    const consolidationTarget = Math.floor(totalServices * 0.6); // Target 40% reduction
    const potentialSavings = totalServices - consolidationTarget;
    
    console.log('\n📈 Expected Results:');
    console.log(`- Current services: ${totalServices}`);
    console.log(`- Target services: ${consolidationTarget}`);
    console.log(`- Services to consolidate: ${potentialSavings}`);
    console.log(`- Complexity reduction: ~${Math.round(potentialSavings / totalServices * 100)}%`);
    console.log(`- Maintenance effort reduction: Significant`);
    
    console.log('\n🚀 Ready to proceed with Phase 2 implementation');
  }
}

async function main() {
  try {
    const analyzer = new ServiceConsolidationAnalyzer();
    await analyzer.analyzeServiceArchitecture();
  } catch (error) {
    console.error('❌ Service analysis failed:', error);
    process.exit(1);
  }
}

main();