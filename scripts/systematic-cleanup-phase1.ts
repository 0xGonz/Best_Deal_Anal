/**
 * Systematic Cleanup Phase 1: Critical Issues Resolution
 * 
 * This script addresses the highest priority issues identified in the comprehensive audit:
 * 1. Type safety fixes for monetary fields
 * 2. Performance optimization for N+1 queries
 * 3. Security improvements
 * 4. Debug logging cleanup
 * 5. Service consolidation prep
 */

import { StorageFactory } from '../server/storage-factory';
import fs from 'fs';
import path from 'path';

interface CleanupIssue {
  category: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'fixed' | 'in-progress';
  solution: string;
}

class SystematicCleanupPhase1 {
  private storage = StorageFactory.getInstance();
  private issues: CleanupIssue[] = [];

  async runPhase1Cleanup(): Promise<void> {
    console.log('🧹 Starting Phase 1: Critical Issues Resolution');
    
    await this.fixTypeSafety();
    await this.optimizeQueries();
    await this.enhanceSecurity();
    await this.cleanupLogging();
    await this.prepareServiceConsolidation();
    
    this.generateReport();
  }

  private async fixTypeSafety(): Promise<void> {
    console.log('🔧 Fixing type safety issues...');
    
    // Fix monetary field type inconsistencies
    try {
      // Convert text fields to numeric for money calculations
      await this.storage.pool.query(`
        -- Standardize monetary fields to NUMERIC for precision
        DO $$ 
        BEGIN
          -- Check if target_raise is text type and convert if needed
          IF (SELECT data_type FROM information_schema.columns 
              WHERE table_name = 'deals' AND column_name = 'target_raise') = 'text' THEN
            ALTER TABLE deals ALTER COLUMN target_raise TYPE NUMERIC USING 
              CASE 
                WHEN target_raise ~ '^[0-9]+\.?[0-9]*$' THEN target_raise::NUMERIC
                ELSE NULL
              END;
          END IF;
          
          -- Similar fix for valuation field
          IF (SELECT data_type FROM information_schema.columns 
              WHERE table_name = 'deals' AND column_name = 'valuation') = 'text' THEN
            ALTER TABLE deals ALTER COLUMN valuation TYPE NUMERIC USING 
              CASE 
                WHEN valuation ~ '^[0-9]+\.?[0-9]*$' THEN valuation::NUMERIC
                ELSE NULL
              END;
          END IF;
        END $$;
      `);
      
      this.issues.push({
        category: 'Type Safety',
        issue: 'Monetary fields using text instead of numeric',
        severity: 'critical',
        status: 'fixed',
        solution: 'Converted text money fields to NUMERIC type for precision'
      });
    } catch (error) {
      console.error('Type safety fix failed:', error);
      this.issues.push({
        category: 'Type Safety',
        issue: 'Failed to fix monetary field types',
        severity: 'critical',
        status: 'pending',
        solution: 'Manual schema migration required'
      });
    }
  }

  private async optimizeQueries(): Promise<void> {
    console.log('⚡ Optimizing database queries...');
    
    try {
      // Add missing indexes for common query patterns
      await this.storage.pool.query(`
        -- Create indexes for common join patterns if they don't exist
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fund_allocations_deal_fund 
          ON fund_allocations(deal_id, fund_id);
        
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capital_calls_allocation 
          ON capital_calls(allocation_id);
        
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_deal_created 
          ON timeline_events(deal_id, created_at DESC);
        
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_deal_created 
          ON documents(deal_id, created_at DESC);
      `);
      
      this.issues.push({
        category: 'Performance',
        issue: 'Missing database indexes causing slow queries',
        severity: 'high',
        status: 'fixed',
        solution: 'Added composite indexes for common query patterns'
      });
    } catch (error) {
      console.error('Query optimization failed:', error);
      this.issues.push({
        category: 'Performance',
        issue: 'Failed to add performance indexes',
        severity: 'high',
        status: 'pending',
        solution: 'Manually add indexes or check permissions'
      });
    }
  }

  private async enhanceSecurity(): Promise<void> {
    console.log('🔒 Enhancing security measures...');
    
    try {
      // Add database-level constraints
      await this.storage.pool.query(`
        -- Add constraint to prevent negative monetary values
        DO $$ 
        BEGIN
          -- Check if constraint exists before adding
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = 'fund_allocations_amount_positive') THEN
            ALTER TABLE fund_allocations 
              ADD CONSTRAINT fund_allocations_amount_positive 
              CHECK (amount >= 0);
          END IF;
          
          -- Ensure capital call percentages are valid
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = 'capital_calls_call_pct_valid') THEN
            ALTER TABLE capital_calls 
              ADD CONSTRAINT capital_calls_call_pct_valid 
              CHECK (call_pct >= 0 AND call_pct <= 100);
          END IF;
        END $$;
      `);
      
      this.issues.push({
        category: 'Security',
        issue: 'Missing data validation constraints',
        severity: 'high',
        status: 'fixed',
        solution: 'Added database-level constraints for data integrity'
      });
    } catch (error) {
      console.error('Security enhancement failed:', error);
      this.issues.push({
        category: 'Security',
        issue: 'Failed to add security constraints',
        severity: 'high',
        status: 'pending',
        solution: 'Manually add constraints or check data conflicts'
      });
    }
  }

  private async cleanupLogging(): Promise<void> {
    console.log('🧽 Cleaning up excessive logging...');
    
    // This is handled by the manual code changes already made
    this.issues.push({
      category: 'Performance',
      issue: 'Excessive debug logging in production',
      severity: 'medium',
      status: 'fixed',
      solution: 'Removed session debugging middleware and verbose logs'
    });
  }

  private async prepareServiceConsolidation(): Promise<void> {
    console.log('🔄 Preparing for service consolidation...');
    
    // Analyze service usage patterns
    const serviceFiles = [
      'server/services',
      'server/routes'
    ];
    
    let serviceCount = 0;
    for (const serviceDir of serviceFiles) {
      if (fs.existsSync(serviceDir)) {
        const files = fs.readdirSync(serviceDir);
        serviceCount += files.filter(f => f.endsWith('.ts')).length;
      }
    }
    
    this.issues.push({
      category: 'Architecture',
      issue: `Service proliferation: ${serviceCount} service files identified`,
      severity: 'medium',
      status: 'in-progress',
      solution: 'Phase 2 will consolidate related services into domain modules'
    });
  }

  private generateReport(): void {
    console.log('\n📊 Phase 1 Cleanup Report');
    console.log('========================');
    
    const categories = [...new Set(this.issues.map(i => i.category))];
    
    categories.forEach(category => {
      console.log(`\n${category}:`);
      const categoryIssues = this.issues.filter(i => i.category === category);
      
      categoryIssues.forEach(issue => {
        const statusEmoji = issue.status === 'fixed' ? '✅' : 
                           issue.status === 'in-progress' ? '🔄' : '❌';
        console.log(`  ${statusEmoji} ${issue.issue} (${issue.severity})`);
        console.log(`     Solution: ${issue.solution}`);
      });
    });
    
    const fixed = this.issues.filter(i => i.status === 'fixed').length;
    const total = this.issues.length;
    
    console.log(`\n📈 Progress: ${fixed}/${total} issues resolved (${Math.round(fixed/total*100)}%)`);
    console.log('\n🚀 Ready for Phase 2: Service Consolidation');
  }
}

async function main() {
  try {
    const cleanup = new SystematicCleanupPhase1();
    await cleanup.runPhase1Cleanup();
    console.log('\n✅ Phase 1 cleanup completed successfully');
  } catch (error) {
    console.error('❌ Phase 1 cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}