#!/usr/bin/env tsx

/**
 * Deal Data Consistency Audit Script
 * 
 * Comprehensive analysis of deal data flow to identify inconsistencies
 * and ensure investments maintain constant deal information throughout the system.
 */

import { DatabaseStorage } from '../server/database-storage';

interface ConsistencyIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  data?: any;
  solution: string;
}

class DealDataConsistencyAuditor {
  private storage = new DatabaseStorage();
  private issues: ConsistencyIssue[] = [];

  async runFullAudit(): Promise<void> {
    console.log('🔍 Starting Deal Data Consistency Audit...\n');

    await this.checkDealDataIntegrity();
    await this.checkAllocationConsistency();
    await this.checkAPIResponseConsistency();
    await this.checkTypeSafety();
    await this.checkDataImmutability();

    this.generateReport();
  }

  private async checkDealDataIntegrity(): Promise<void> {
    console.log('Checking deal data integrity...');
    
    try {
      // Check for orphaned allocations
      const allAllocations = await this.storage.getAllocationsByFund(2);
      const deals = await this.storage.getDeals();
      const dealIds = new Set(deals.map(d => d.id));

      for (const allocation of allAllocations) {
        if (!dealIds.has(allocation.dealId)) {
          this.issues.push({
            severity: 'critical',
            category: 'Data Integrity',
            description: `Allocation ${allocation.id} references non-existent deal ${allocation.dealId}`,
            data: { allocationId: allocation.id, dealId: allocation.dealId },
            solution: 'Remove orphaned allocation or restore missing deal record'
          });
        }

        // Check for null vs undefined inconsistencies
        if ('dealName' in allocation && allocation.dealName === null) {
          this.issues.push({
            severity: 'high',
            category: 'Type Safety',
            description: `Allocation ${allocation.id} has null dealName instead of undefined`,
            data: { allocationId: allocation.id, dealName: allocation.dealName },
            solution: 'Standardize null/undefined handling in database queries'
          });
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'critical',
        category: 'Database Access',
        description: 'Failed to access allocation or deal data',
        data: { error: error instanceof Error ? error.message : String(error) },
        solution: 'Fix database connection or query issues'
      });
    }
  }

  private async checkAllocationConsistency(): Promise<void> {
    console.log('Checking allocation data consistency...');
    
    try {
      // Get same allocation from different endpoints
      const fundAllocations = await this.storage.getAllocationsByFund(2);
      
      for (const allocation of fundAllocations) {
        const dealAllocations = await this.storage.getAllocationsByDeal(allocation.dealId);
        const matchingAllocation = dealAllocations.find(a => a.id === allocation.id);
        
        if (!matchingAllocation) {
          this.issues.push({
            severity: 'critical',
            category: 'Data Consistency',
            description: `Allocation ${allocation.id} missing from deal-level query`,
            data: { allocationId: allocation.id, dealId: allocation.dealId },
            solution: 'Fix database query consistency between fund and deal perspectives'
          });
          continue;
        }

        // Compare deal data consistency
        if (allocation.dealName !== matchingAllocation.dealName) {
          this.issues.push({
            severity: 'high',
            category: 'Data Consistency',
            description: `Deal name mismatch for allocation ${allocation.id}`,
            data: { 
              allocationId: allocation.id,
              fundView: allocation.dealName,
              dealView: matchingAllocation.dealName
            },
            solution: 'Ensure consistent JOIN queries across all allocation endpoints'
          });
        }

        if (allocation.dealSector !== matchingAllocation.dealSector) {
          this.issues.push({
            severity: 'high',
            category: 'Data Consistency',
            description: `Deal sector mismatch for allocation ${allocation.id}`,
            data: { 
              allocationId: allocation.id,
              fundView: allocation.dealSector,
              dealView: matchingAllocation.dealSector
            },
            solution: 'Ensure consistent JOIN queries across all allocation endpoints'
          });
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'critical',
        category: 'Consistency Check',
        description: 'Failed to perform allocation consistency check',
        data: { error: error instanceof Error ? error.message : String(error) },
        solution: 'Fix database query or access issues'
      });
    }
  }

  private async checkAPIResponseConsistency(): Promise<void> {
    console.log('Checking API response consistency...');
    
    // This would require HTTP requests to API endpoints
    // For now, we'll check the storage layer directly
    try {
      const fundAllocations = await this.storage.getAllocationsByFund(2);
      
      for (const allocation of fundAllocations) {
        // Verify deal data is populated correctly
        if (!allocation.dealName || allocation.dealName.startsWith('Deal ')) {
          this.issues.push({
            severity: 'medium',
            category: 'API Response',
            description: `Allocation ${allocation.id} has placeholder or missing deal name`,
            data: { allocationId: allocation.id, dealName: allocation.dealName },
            solution: 'Ensure database JOIN queries properly populate deal names'
          });
        }

        if (!allocation.dealSector || allocation.dealSector === 'Unknown') {
          this.issues.push({
            severity: 'medium',
            category: 'API Response',
            description: `Allocation ${allocation.id} has placeholder or missing deal sector`,
            data: { allocationId: allocation.id, dealSector: allocation.dealSector },
            solution: 'Ensure database JOIN queries properly populate deal sectors'
          });
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'critical',
        category: 'API Response',
        description: 'Failed to check API response consistency',
        data: { error: error instanceof Error ? error.message : String(error) },
        solution: 'Fix storage layer access issues'
      });
    }
  }

  private async checkTypeSafety(): Promise<void> {
    console.log('Checking type safety...');
    
    // Check for type mismatches in allocation data
    try {
      const allocations = await this.storage.getAllocationsByFund(2);
      
      for (const allocation of allocations) {
        // Check for null vs undefined issues
        const hasNullValues = Object.entries(allocation).some(([key, value]) => 
          value === null && ['dealName', 'dealSector'].includes(key)
        );
        
        if (hasNullValues) {
          this.issues.push({
            severity: 'medium',
            category: 'Type Safety',
            description: `Allocation ${allocation.id} has null values where undefined expected`,
            data: { allocationId: allocation.id },
            solution: 'Update database queries to handle null/undefined consistently'
          });
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'high',
        category: 'Type Safety',
        description: 'Failed to perform type safety check',
        data: { error: error instanceof Error ? error.message : String(error) },
        solution: 'Fix type definitions and database query return types'
      });
    }
  }

  private async checkDataImmutability(): Promise<void> {
    console.log('Checking data immutability...');
    
    try {
      // Check if deal data changes affect existing allocations
      const allocations = await this.storage.getAllocationsByFund(2);
      const deals = await this.storage.getDeals();
      
      for (const allocation of allocations) {
        const currentDeal = deals.find(d => d.id === allocation.dealId);
        
        if (!currentDeal) {
          continue; // Already handled in integrity check
        }
        
        // In a real system, we'd check historical data
        // For now, verify current consistency
        if (allocation.dealName !== currentDeal.name) {
          this.issues.push({
            severity: 'high',
            category: 'Data Immutability',
            description: `Allocation ${allocation.id} deal name doesn't match current deal`,
            data: { 
              allocationId: allocation.id,
              allocationDealName: allocation.dealName,
              currentDealName: currentDeal.name
            },
            solution: 'Implement deal data snapshot at allocation creation time'
          });
        }
        
        if (allocation.dealSector !== currentDeal.sector) {
          this.issues.push({
            severity: 'high',
            category: 'Data Immutability',
            description: `Allocation ${allocation.id} deal sector doesn't match current deal`,
            data: { 
              allocationId: allocation.id,
              allocationDealSector: allocation.dealSector,
              currentDealSector: currentDeal.sector
            },
            solution: 'Implement deal data snapshot at allocation creation time'
          });
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'medium',
        category: 'Data Immutability',
        description: 'Failed to check data immutability',
        data: { error: error instanceof Error ? error.message : String(error) },
        solution: 'Implement proper data versioning and immutability checks'
      });
    }
  }

  private generateReport(): void {
    console.log('\n📊 Deal Data Consistency Audit Report');
    console.log('=====================================\n');

    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    const highIssues = this.issues.filter(i => i.severity === 'high');
    const mediumIssues = this.issues.filter(i => i.severity === 'medium');
    const lowIssues = this.issues.filter(i => i.severity === 'low');

    console.log(`🔴 Critical Issues: ${criticalIssues.length}`);
    console.log(`🟠 High Priority Issues: ${highIssues.length}`);
    console.log(`🟡 Medium Priority Issues: ${mediumIssues.length}`);
    console.log(`🟢 Low Priority Issues: ${lowIssues.length}`);
    console.log(`\nTotal Issues Found: ${this.issues.length}\n`);

    if (this.issues.length === 0) {
      console.log('✅ No consistency issues detected! Deal data flow is working correctly.');
      return;
    }

    // Group issues by category
    const categories = [...new Set(this.issues.map(i => i.category))];
    
    categories.forEach(category => {
      const categoryIssues = this.issues.filter(i => i.category === category);
      console.log(`\n📂 ${category} (${categoryIssues.length} issues)`);
      console.log('='.repeat(category.length + 20));
      
      categoryIssues.forEach((issue, index) => {
        const severityIcon = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }[issue.severity];
        
        console.log(`\n${index + 1}. ${severityIcon} ${issue.description}`);
        if (issue.data) {
          console.log(`   Data: ${JSON.stringify(issue.data, null, 2)}`);
        }
        console.log(`   Solution: ${issue.solution}`);
      });
    });

    console.log('\n🔧 Recommended Actions:');
    console.log('1. Fix critical issues first (data integrity problems)');
    console.log('2. Address high priority issues (consistency problems)');
    console.log('3. Resolve type safety issues');
    console.log('4. Implement data immutability protections');
    console.log('5. Add automated consistency checks to CI/CD pipeline');
  }
}

async function main() {
  const auditor = new DealDataConsistencyAuditor();
  await auditor.runFullAudit();
}

if (require.main === module) {
  main().catch(console.error);
}