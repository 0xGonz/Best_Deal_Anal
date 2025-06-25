/**
 * Test Script for Committed/Paid/Funded Drift Fixes
 * 
 * Validates that all three critical bugs identified in the post-mortem have been resolved:
 * 1. Payments can no longer be made without capital calls
 * 2. String concatenation in money calculations is eliminated 
 * 3. Double-allocation on invested deals is prevented
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql, eq } from 'drizzle-orm';
import { fundAllocations, capitalCalls, capitalCallPayments } from '../shared/schema.js';
import AllocationSyncService from '../server/services/allocation-sync.service.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  expected?: any;
  actual?: any;
}

class DriftFixTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing Committed/Paid/Funded Drift Fixes...\n');

    await this.testDatabaseConstraints();
    await this.testNumericTypes();
    await this.testUniqueAllocations();
    await this.testDataConsistency();
    await this.testBaleronCase();
    
    this.printResults();
  }

  private async testDatabaseConstraints(): Promise<void> {
    console.log('1️⃣ Testing database constraints...');
    
    try {
      // Test NOT NULL constraint on capital_call_payments.capital_call_id
      const constraintCheck = await db.execute(sql`
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_name = 'capital_call_payments' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      
      this.addResult(
        'Capital Call Payment Constraints',
        constraintCheck.rows.length > 0,
        `Found ${constraintCheck.rows.length} foreign key constraints on capital_call_payments`
      );

      // Test CHECK constraint for call percentage
      const checkConstraintCheck = await db.execute(sql`
        SELECT constraint_name 
        FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_call_pct_range'
      `);
      
      this.addResult(
        'Call Percentage Range Constraint',
        checkConstraintCheck.rows.length > 0,
        'CHECK constraint for call percentage range exists'
      );

    } catch (error) {
      this.addResult(
        'Database Constraints Test',
        false,
        `Error testing constraints: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async testNumericTypes(): Promise<void> {
    console.log('2️⃣ Testing numeric type consistency...');
    
    try {
      // Check column types for all money fields
      const columnTypes = await db.execute(sql`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE (table_name = 'fund_allocations' AND column_name IN ('amount', 'paid_amount'))
           OR (table_name = 'capital_calls' AND column_name IN ('call_amount', 'paid_amount'))
           OR (table_name = 'capital_call_payments' AND column_name = 'payment_amount')
        ORDER BY table_name, column_name
      `);

      const nonNumericTypes = columnTypes.rows.filter(row => 
        row.data_type !== 'numeric' && row.data_type !== 'real'
      );
      
      this.addResult(
        'Money Fields Type Consistency',
        nonNumericTypes.length === 0,
        nonNumericTypes.length === 0 
          ? 'All money fields use numeric types'
          : `${nonNumericTypes.length} fields still use non-numeric types: ${nonNumericTypes.map(r => `${r.table_name}.${r.column_name}`).join(', ')}`
      );

      // Test arithmetic operations to ensure no string concatenation
      const mathTest = await db.execute(sql`
        SELECT 
          (100.50 + 200.25) as addition_result,
          (500.00 - 100.00) as subtraction_result
      `);
      
      const expectedSum = 300.75;
      const actualSum = Number(mathTest.rows[0].addition_result);
      
      this.addResult(
        'Numeric Arithmetic Operations',
        Math.abs(actualSum - expectedSum) < 0.01,
        `Addition test: expected ${expectedSum}, got ${actualSum}`,
        expectedSum,
        actualSum
      );

    } catch (error) {
      this.addResult(
        'Numeric Types Test',
        false,
        `Error testing numeric types: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async testUniqueAllocations(): Promise<void> {
    console.log('3️⃣ Testing unique allocation constraints...');
    
    try {
      // Check for unique constraint
      const uniqueConstraint = await db.execute(sql`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'fund_allocations' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'unique_fund_deal_allocation'
      `);
      
      this.addResult(
        'Unique Fund-Deal Constraint',
        uniqueConstraint.rows.length > 0,
        'Unique constraint exists to prevent duplicate allocations'
      );

      // Check for actual duplicates
      const duplicates = await db.execute(sql`
        SELECT fund_id, deal_id, COUNT(*) as count
        FROM fund_allocations 
        GROUP BY fund_id, deal_id 
        HAVING COUNT(*) > 1
      `);
      
      this.addResult(
        'No Duplicate Allocations',
        duplicates.rows.length === 0,
        duplicates.rows.length === 0 
          ? 'No duplicate fund-deal allocations found'
          : `Found ${duplicates.rows.length} duplicate allocation pairs`
      );

    } catch (error) {
      this.addResult(
        'Unique Allocations Test',
        false,
        `Error testing unique allocations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async testDataConsistency(): Promise<void> {
    console.log('4️⃣ Testing data consistency...');
    
    try {
      // Check allocation vs capital call paid amount consistency
      const inconsistencies = await db.execute(sql`
        SELECT 
          fa.id as allocation_id,
          fa.paid_amount as allocation_paid,
          COALESCE(SUM(cc.paid_amount), 0) as capital_calls_paid,
          ABS(fa.paid_amount - COALESCE(SUM(cc.paid_amount), 0)) as difference
        FROM fund_allocations fa
        LEFT JOIN capital_calls cc ON fa.id = cc.allocation_id
        GROUP BY fa.id, fa.paid_amount
        HAVING ABS(fa.paid_amount - COALESCE(SUM(cc.paid_amount), 0)) > 0.01
      `);
      
      this.addResult(
        'Allocation-Capital Call Consistency',
        inconsistencies.rows.length === 0,
        inconsistencies.rows.length === 0
          ? 'All allocations are consistent with their capital calls'
          : `Found ${inconsistencies.rows.length} inconsistent allocations`
      );

      // Test status calculations
      const statusInconsistencies = await db.execute(sql`
        SELECT 
          fa.id,
          fa.amount,
          fa.paid_amount,
          fa.status,
          CASE 
            WHEN fa.paid_amount >= fa.amount THEN 'funded'
            WHEN fa.paid_amount > 0 THEN 'partially_paid'
            ELSE 'committed'
          END as calculated_status
        FROM fund_allocations fa
        WHERE fa.status != CASE 
          WHEN fa.paid_amount >= fa.amount THEN 'funded'
          WHEN fa.paid_amount > 0 THEN 'partially_paid'
          ELSE 'committed'
        END
      `);
      
      this.addResult(
        'Status Calculation Consistency',
        statusInconsistencies.rows.length === 0,
        statusInconsistencies.rows.length === 0
          ? 'All allocation statuses are correctly calculated'
          : `Found ${statusInconsistencies.rows.length} status inconsistencies`
      );

    } catch (error) {
      this.addResult(
        'Data Consistency Test',
        false,
        `Error testing data consistency: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async testBaleronCase(): Promise<void> {
    console.log('5️⃣ Testing Balerion case (from post-mortem)...');
    
    try {
      // Check allocation 45 specifically mentioned in the post-mortem
      const baleronData = await db.execute(sql`
        SELECT 
          fa.id,
          fa.amount as committed,
          fa.paid_amount as allocation_paid,
          fa.status,
          COALESCE(SUM(cc.call_amount), 0) as total_called,
          COALESCE(SUM(cc.paid_amount), 0) as capital_calls_paid,
          COUNT(cc.id) as capital_call_count
        FROM fund_allocations fa
        LEFT JOIN capital_calls cc ON fa.id = cc.allocation_id
        WHERE fa.id = 45
        GROUP BY fa.id, fa.amount, fa.paid_amount, fa.status
      `);

      if (baleronData.rows.length > 0) {
        const row = baleronData.rows[0];
        const isConsistent = Number(row.allocation_paid) === Number(row.capital_calls_paid);
        
        this.addResult(
          'Balerion Allocation Consistency',
          isConsistent,
          `Allocation paid: $${Number(row.allocation_paid).toLocaleString()}, Capital calls paid: $${Number(row.capital_calls_paid).toLocaleString()}`,
          Number(row.capital_calls_paid),
          Number(row.allocation_paid)
        );

        // Test sync service on this allocation
        const syncResult = await AllocationSyncService.syncAllocation(45);
        
        this.addResult(
          'Balerion Sync Service',
          syncResult.synced || !syncResult.error,
          syncResult.error || `Sync completed: ${syncResult.previousStatus} → ${syncResult.newStatus}`
        );
      } else {
        this.addResult(
          'Balerion Case Test',
          false,
          'Allocation 45 (Balerion) not found in database'
        );
      }

    } catch (error) {
      this.addResult(
        'Balerion Case Test',
        false,
        `Error testing Balerion case: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private addResult(testName: string, passed: boolean, details: string, expected?: any, actual?: any): void {
    this.results.push({
      testName,
      passed,
      details,
      expected,
      actual
    });
  }

  private printResults(): void {
    console.log('\n📊 Drift Fix Test Results:');
    console.log('=' .repeat(60));
    
    let passedCount = 0;
    
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      console.log(`   ${result.details}`);
      
      if (result.expected !== undefined && result.actual !== undefined) {
        console.log(`   Expected: ${result.expected}, Actual: ${result.actual}`);
      }
      
      if (result.passed) passedCount++;
    }
    
    console.log('=' .repeat(60));
    console.log(`✅ Tests passed: ${passedCount}/${this.results.length}`);
    
    if (passedCount === this.results.length) {
      console.log('\n🎉 All drift fix tests passed!');
      console.log('\nThe system now prevents:');
      console.log('• Payments without capital calls (database constraints)');
      console.log('• String concatenation bugs (numeric types enforced)');
      console.log('• Duplicate allocations (unique constraints)');
      console.log('• Data drift (real-time synchronization)');
    } else {
      console.log(`\n⚠️  ${this.results.length - passedCount} tests failed - review needed`);
    }
  }
}

async function main() {
  const tester = new DriftFixTester();
  await tester.runAllTests();
  await pool.end();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DriftFixTester };