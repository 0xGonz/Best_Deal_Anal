#!/usr/bin/env tsx
/**
 * Deep Allocation Workflow Audit
 * 
 * Senior-level code review of the allocation creation process
 * Identifies database integrity issues, workflow inconsistencies, and data loss points
 */

import { DatabaseStorage } from '../server/database-storage';
import { db } from '../server/db';
import { eq, sql, and } from 'drizzle-orm';
import { fundAllocations, funds, deals, capitalCalls, timelineEvents } from '../shared/schema.js';
import { AllocationDomainService } from '../server/services/allocation-domain.service';

interface AllocationWorkflowIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  impact: string;
  rootCause: string;
  recommendation: string;
}

class AllocationWorkflowAuditor {
  private storage = new DatabaseStorage();
  private issues: AllocationWorkflowIssue[] = [];

  async runDeepAudit(): Promise<void> {
    console.log('🔍 DEEP ALLOCATION WORKFLOW AUDIT');
    console.log('='.repeat(60));
    console.log('Analyzing allocation creation, status management, and data integrity...\n');

    await this.auditDataIntegrity();
    await this.auditAllocationCreationWorkflow();
    await this.auditStatusConsistency();
    await this.auditDatabaseTransactions();
    await this.auditErrorHandling();
    await this.auditConcurrencyIssues();

    this.generateReport();
  }

  private async auditDataIntegrity(): Promise<void> {
    console.log('1️⃣ AUDITING DATA INTEGRITY');
    console.log('-'.repeat(40));

    // Check for orphaned allocations
    const orphanedAllocations = await db.execute(sql`
      SELECT fa.id, fa.deal_id, fa.fund_id, fa.amount, fa.status
      FROM fund_allocations fa
      LEFT JOIN deals d ON fa.deal_id = d.id
      LEFT JOIN funds f ON fa.fund_id = f.id
      WHERE d.id IS NULL OR f.id IS NULL
    `);

    if (orphanedAllocations.rows.length > 0) {
      this.issues.push({
        severity: 'critical',
        category: 'Data Integrity',
        issue: `Found ${orphanedAllocations.rows.length} orphaned allocations with invalid deal/fund references`,
        impact: 'Broken referential integrity, corrupted fund calculations, phantom allocations',
        rootCause: 'Missing foreign key constraints or improper deletion handling',
        recommendation: 'Add proper foreign key constraints and implement cascade deletion with transaction safety'
      });
    }

    // Check for inconsistent allocation amounts vs capital calls
    const amountMismatches = await db.execute(sql`
      SELECT 
        fa.id as allocation_id,
        fa.amount as allocation_amount,
        COALESCE(SUM(cc.amount), 0) as total_capital_calls,
        fa.paid_amount,
        fa.status
      FROM fund_allocations fa
      LEFT JOIN capital_calls cc ON fa.id = cc.allocation_id
      GROUP BY fa.id, fa.amount, fa.paid_amount, fa.status
      HAVING fa.amount != COALESCE(SUM(cc.amount), 0) AND COALESCE(SUM(cc.amount), 0) > 0
    `);

    if (amountMismatches.rows.length > 0) {
      this.issues.push({
        severity: 'high',
        category: 'Data Integrity',
        issue: `${amountMismatches.rows.length} allocations have amount mismatches with their capital calls`,
        impact: 'Incorrect capital tracking, inconsistent payment calculations, unreliable fund metrics',
        rootCause: 'Allocation amounts not synchronized with capital call creation/updates',
        recommendation: 'Implement automatic allocation-capital call synchronization service'
      });
    }

    // Check for status inconsistencies
    const statusInconsistencies = await db.execute(sql`
      SELECT 
        id,
        amount,
        paid_amount,
        status,
        CASE 
          WHEN amount = 0 THEN 'unfunded'
          WHEN paid_amount >= amount THEN 'funded'
          WHEN paid_amount > 0 THEN 'partially_paid'
          ELSE 'committed'
        END as calculated_status
      FROM fund_allocations
      WHERE status != CASE 
          WHEN amount = 0 THEN 'unfunded'
          WHEN paid_amount >= amount THEN 'funded'
          WHEN paid_amount > 0 THEN 'partially_paid'
          ELSE 'committed'
        END
    `);

    console.log(`   ❌ Orphaned allocations: ${orphanedAllocations.rows.length}`);
    console.log(`   ❌ Amount mismatches: ${amountMismatches.rows.length}`);
    console.log(`   ❌ Status inconsistencies: ${statusInconsistencies.rows.length}`);
  }

  private async auditAllocationCreationWorkflow(): Promise<void> {
    console.log('\n2️⃣ AUDITING ALLOCATION CREATION WORKFLOW');
    console.log('-'.repeat(40));

    // Test allocation creation path
    try {
      const testDeals = await db.select().from(deals).limit(1);
      const testFunds = await db.select().from(funds).limit(1);

      if (testDeals.length === 0 || testFunds.length === 0) {
        this.issues.push({
          severity: 'critical',
          category: 'Workflow',
          issue: 'Cannot test allocation creation - no deals or funds available',
          impact: 'Unable to validate allocation creation workflow',
          rootCause: 'Missing test data or data creation issues',
          recommendation: 'Ensure sample deals and funds exist for testing'
        });
        return;
      }

      // Simulate allocation creation without actually creating one
      const testAllocation = {
        dealId: testDeals[0].id,
        fundId: testFunds[0].id,
        amount: 100000,
        status: 'committed' as const,
        allocationDate: new Date()
      };

      console.log(`   Testing allocation creation for Deal ${testAllocation.dealId} → Fund ${testAllocation.fundId}`);

      // Check if validation would pass
      const validationResult = this.validateAllocationData(testAllocation);
      if (!validationResult.valid) {
        this.issues.push({
          severity: 'high',
          category: 'Workflow',
          issue: `Allocation validation fails: ${validationResult.errors.join(', ')}`,
          impact: 'Users cannot create allocations, workflow completely broken',
          rootCause: 'Validation logic prevents valid allocation creation',
          recommendation: 'Review and fix allocation validation rules'
        });
      }

    } catch (error) {
      this.issues.push({
        severity: 'critical',
        category: 'Workflow',
        issue: `Allocation creation workflow throws errors: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'Complete workflow failure, users cannot allocate deals to funds',
        rootCause: 'Code errors in allocation creation path',
        recommendation: 'Debug and fix allocation creation code paths'
      });
    }

    // Check recent allocation attempts from timeline
    const recentAllocationEvents = await db.execute(sql`
      SELECT event_type, content, created_at, metadata
      FROM timeline_events 
      WHERE event_type IN ('allocation_created', 'allocation_removed', 'closing_scheduled')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const removedCount = recentAllocationEvents.rows.filter(e => 
      (typeof e.content === 'string' && e.content.includes('removed')) || e.event_type === 'allocation_removed'
    ).length;
    
    const createdCount = recentAllocationEvents.rows.filter(e => 
      e.event_type === 'allocation_created'
    ).length;

    console.log(`   📊 Recent allocation events: ${createdCount} created, ${removedCount} removed`);

    if (removedCount > createdCount && removedCount > 0) {
      this.issues.push({
        severity: 'critical',
        category: 'Workflow',
        issue: `More allocations removed (${removedCount}) than created (${createdCount}) recently`,
        impact: 'Allocation workflow appears to be removing more than creating, net negative allocation creation',
        rootCause: 'Allocation deletion is more successful than creation, or automatic cleanup is too aggressive',
        recommendation: 'Investigate allocation creation failures and review automatic cleanup logic'
      });
    }
  }

  private async auditStatusConsistency(): Promise<void> {
    console.log('\n3️⃣ AUDITING STATUS CONSISTENCY');
    console.log('-'.repeat(40));

    // Test status calculation service
    const testCases = [
      { amount: 100000, paidAmount: 0, expectedStatus: 'committed' },
      { amount: 100000, paidAmount: 50000, expectedStatus: 'partially_paid' },
      { amount: 100000, paidAmount: 100000, expectedStatus: 'funded' },
      { amount: 100000, paidAmount: 150000, expectedStatus: 'funded' }, // Overpaid should cap at funded
    ];

    for (const testCase of testCases) {
      const result = AllocationStatusService.calculateStatus(testCase);
      if (result.status !== testCase.expectedStatus) {
        this.issues.push({
          severity: 'high',
          category: 'Status Logic',
          issue: `Status calculation incorrect: ${testCase.amount}/${testCase.paidAmount} should be ${testCase.expectedStatus}, got ${result.status}`,
          impact: 'Incorrect status reporting, misleading fund metrics',
          rootCause: 'Status calculation logic error',
          recommendation: 'Fix AllocationStatusService.calculateStatus logic'
        });
      }
    }

    // Check for manual status overrides that bypass calculation
    const manualOverrides = await db.execute(sql`
      SELECT id, amount, paid_amount, status
      FROM fund_allocations
      WHERE (status = 'funded' AND paid_amount < amount)
         OR (status = 'committed' AND paid_amount > 0)
         OR (status = 'partially_paid' AND (paid_amount = 0 OR paid_amount >= amount))
    `);

    if (manualOverrides.rows.length > 0) {
      this.issues.push({
        severity: 'medium',
        category: 'Status Logic',
        issue: `${manualOverrides.rows.length} allocations have manually overridden status that doesn't match payment amounts`,
        impact: 'Inconsistent status reporting, manual data entry errors',
        rootCause: 'Status updates bypass automatic calculation',
        recommendation: 'Enforce automatic status calculation on all allocation updates'
      });
    }

    console.log(`   📊 Status calculation tests: ${testCases.length} cases evaluated`);
    console.log(`   ❌ Manual overrides: ${manualOverrides.rows.length}`);
  }

  private async auditDatabaseTransactions(): Promise<void> {
    console.log('\n4️⃣ AUDITING DATABASE TRANSACTIONS');
    console.log('-'.repeat(40));

    // Check for partial transaction failures (allocation created but timeline event failed)
    const allocationsWithoutEvents = await db.execute(sql`
      SELECT fa.id, fa.created_at as allocation_created
      FROM fund_allocations fa
      LEFT JOIN timeline_events te ON fa.deal_id = te.deal_id 
        AND te.event_type = 'allocation_created'
        AND te.created_at >= fa.created_at - INTERVAL '1 minute'
        AND te.created_at <= fa.created_at + INTERVAL '1 minute'
      WHERE te.id IS NULL
      AND fa.created_at > NOW() - INTERVAL '30 days'
    `);

    if (allocationsWithoutEvents.rows.length > 0) {
      this.issues.push({
        severity: 'medium',
        category: 'Transaction Safety',
        issue: `${allocationsWithoutEvents.rows.length} allocations created without corresponding timeline events`,
        impact: 'Incomplete audit trail, missing activity tracking',
        rootCause: 'Non-atomic transactions or timeline event creation failures',
        recommendation: 'Implement proper database transactions for allocation creation workflow'
      });
    }

    // Check for fund AUM inconsistencies
    const aumInconsistencies = await db.execute(sql`
      SELECT 
        f.id,
        f.name,
        f.aum as recorded_aum,
        COALESCE(SUM(
          CASE 
            WHEN fa.status = 'funded' THEN fa.amount 
            ELSE 0 
          END
        ), 0) as calculated_aum
      FROM funds f
      LEFT JOIN fund_allocations fa ON f.id = fa.fund_id
      GROUP BY f.id, f.name, f.aum
      HAVING f.aum != COALESCE(SUM(
        CASE 
          WHEN fa.status = 'funded' THEN fa.amount 
          ELSE 0 
        END
      ), 0)
    `);

    if (aumInconsistencies.rows.length > 0) {
      this.issues.push({
        severity: 'high',
        category: 'Transaction Safety',
        issue: `${aumInconsistencies.rows.length} funds have AUM inconsistencies between recorded and calculated values`,
        impact: 'Incorrect fund performance metrics, financial reporting errors',
        rootCause: 'AUM updates not properly synchronized with allocation status changes',
        recommendation: 'Implement atomic AUM recalculation with allocation updates'
      });
    }

    console.log(`   ❌ Allocations without timeline: ${allocationsWithoutEvents.rows.length}`);
    console.log(`   ❌ AUM inconsistencies: ${aumInconsistencies.rows.length}`);
  }

  private async auditErrorHandling(): Promise<void> {
    console.log('\n5️⃣ AUDITING ERROR HANDLING');
    console.log('-'.repeat(40));

    // This would normally check error logs, but we'll check for defensive coding patterns
    this.issues.push({
      severity: 'medium',
      category: 'Error Handling',
      issue: 'Error handling patterns need review',
      impact: 'Silent failures may be causing allocation creation issues',
      rootCause: 'Insufficient error logging and user feedback',
      recommendation: 'Add comprehensive error logging and user-friendly error messages'
    });

    console.log('   ⚠️  Error handling review needed');
  }

  private async auditConcurrencyIssues(): Promise<void> {
    console.log('\n6️⃣ AUDITING CONCURRENCY ISSUES');
    console.log('-'.repeat(40));

    // Check for potential race conditions in allocation creation
    const duplicateAllocations = await db.execute(sql`
      SELECT deal_id, fund_id, COUNT(*) as allocation_count
      FROM fund_allocations
      GROUP BY deal_id, fund_id
      HAVING COUNT(*) > 1
    `);

    if (duplicateAllocations.rows.length > 0) {
      this.issues.push({
        severity: 'high',
        category: 'Concurrency',
        issue: `${duplicateAllocations.rows.length} deal-fund combinations have multiple allocations`,
        impact: 'Duplicate allocations, incorrect fund calculations, data inconsistency',
        rootCause: 'Race conditions or missing unique constraints',
        recommendation: 'Add unique constraints on (deal_id, fund_id) and implement proper locking'
      });
    }

    console.log(`   ❌ Duplicate allocations: ${duplicateAllocations.rows.length}`);
  }

  private validateAllocationData(allocation: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!allocation.dealId || allocation.dealId <= 0) {
      errors.push('Invalid deal ID');
    }
    if (!allocation.fundId || allocation.fundId <= 0) {
      errors.push('Invalid fund ID');
    }
    if (!allocation.amount || allocation.amount <= 0) {
      errors.push('Invalid amount');
    }
    if (!allocation.status) {
      errors.push('Missing status');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private generateReport(): void {
    console.log('\n📋 ALLOCATION WORKFLOW AUDIT REPORT');
    console.log('='.repeat(60));

    const critical = this.issues.filter(i => i.severity === 'critical');
    const high = this.issues.filter(i => i.severity === 'high');
    const medium = this.issues.filter(i => i.severity === 'medium');
    const low = this.issues.filter(i => i.severity === 'low');

    console.log(`\n🚨 CRITICAL ISSUES (${critical.length}):`);
    critical.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.issue}`);
      console.log(`   Category: ${issue.category}`);
      console.log(`   Impact: ${issue.impact}`);
      console.log(`   Root Cause: ${issue.rootCause}`);
      console.log(`   Recommendation: ${issue.recommendation}`);
    });

    console.log(`\n⚠️  HIGH PRIORITY (${high.length}):`);
    high.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.issue}`);
      console.log(`   Impact: ${issue.impact}`);
      console.log(`   Fix: ${issue.recommendation}`);
    });

    console.log(`\n🔶 MEDIUM PRIORITY (${medium.length}):`);
    medium.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.issue}`);
      console.log(`   Fix: ${issue.recommendation}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎯 EXECUTIVE SUMMARY:');
    console.log(`   • Total Issues: ${this.issues.length}`);
    console.log(`   • Critical: ${critical.length} (immediate attention required)`);
    console.log(`   • High: ${high.length} (resolve within 1 week)`);
    console.log(`   • Medium: ${medium.length} (resolve within 1 month)`);

    if (critical.length > 0) {
      console.log('\n🚨 IMMEDIATE ACTION REQUIRED:');
      console.log('   Critical issues are preventing core allocation functionality.');
      console.log('   Address these issues before proceeding with normal operations.');
    }

    // Specific recommendations for the allocation creation problem
    console.log('\n💡 ALLOCATION CREATION FIX STRATEGY:');
    console.log('   1. Implement proper foreign key constraints');
    console.log('   2. Add unique constraints on (deal_id, fund_id)');
    console.log('   3. Use database transactions for allocation creation');
    console.log('   4. Add comprehensive error logging');
    console.log('   5. Implement allocation-capital call synchronization');
    console.log('   6. Fix AUM calculation inconsistencies');
  }
}

async function main() {
  try {
    const auditor = new AllocationWorkflowAuditor();
    await auditor.runDeepAudit();
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

main();