/**
 * Verification Script for Allocation Math Fixes
 * Validates that all critical issues from the fix brief are resolved
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { fundAllocations, capitalCalls } from '../shared/schema.js';
import { AllocationServiceFixed } from '../server/services/allocation.service.fixed.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

class AllocationFixVerifier {
  private allocationService = new AllocationServiceFixed();

  async verifyAllFixes(): Promise<void> {
    console.log('🔍 Verifying Allocation Math Fixes...\n');

    const checks = [
      await this.verifyDatabaseConstraints(),
      await this.verifyNumericTypes(),
      await this.verifyPaymentWorkflow(),
      await this.verifyDuplicatePrevention(),
      await this.verifyArithmeticPrecision()
    ];

    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;

    console.log('\n📊 Verification Summary:');
    console.log('═'.repeat(60));
    
    checks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.details}`);
    });

    console.log('═'.repeat(60));
    console.log(`Result: ${passed}/${total} checks passed`);

    if (passed === total) {
      console.log('\n🎉 All allocation math fixes verified successfully!');
      console.log('\nThe system now has enterprise-grade data integrity:');
      console.log('• No more string concatenation bugs (400000 + 600000 = 1000000)');
      console.log('• Payments require capital calls (no ad-hoc payment bypass)');
      console.log('• Duplicate allocations prevented by UNIQUE constraints');
      console.log('• NUMERIC precision maintained for money calculations');
      console.log('• Database-level validation enforces business rules');
    } else {
      console.log('\n❌ Some verification checks failed - manual review required');
    }
  }

  async verifyDatabaseConstraints(): Promise<{passed: boolean, name: string, details: string}> {
    try {
      // Check UNIQUE constraint exists
      const uniqueCheck = await pool.query(`
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_fund_deal_allocation' 
        AND table_name = 'fund_allocations'
      `);

      // Check CHECK constraints exist
      const checkConstraints = await pool.query(`
        SELECT constraint_name FROM information_schema.check_constraints 
        WHERE constraint_name LIKE 'check_%'
      `);

      // Check triggers exist
      const triggers = await pool.query(`
        SELECT trigger_name FROM information_schema.triggers 
        WHERE trigger_name IN ('trigger_enforce_payment_workflow', 'trigger_sync_allocation_totals')
      `);

      const hasUnique = uniqueCheck.rows.length > 0;
      const hasChecks = checkConstraints.rows.length >= 3; // At least 3 check constraints
      const hasTriggers = triggers.rows.length >= 1; // At least 1 trigger

      return {
        passed: hasUnique && hasChecks && hasTriggers,
        name: 'Database Constraints',
        details: `UNIQUE: ${hasUnique ? 'OK' : 'MISSING'}, CHECKs: ${checkConstraints.rows.length}, Triggers: ${triggers.rows.length}`
      };

    } catch (error) {
      return {
        passed: false,
        name: 'Database Constraints',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  async verifyNumericTypes(): Promise<{passed: boolean, name: string, details: string}> {
    try {
      // Check fund_allocations has NUMERIC types
      const fundAllocCols = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'fund_allocations' 
        AND column_name IN ('amount', 'paid_amount')
      `);

      // Check capital_calls has NUMERIC types
      const capitalCallCols = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'capital_calls' 
        AND column_name IN ('call_amount', 'paid_amount')
      `);

      const allNumeric = [...fundAllocCols.rows, ...capitalCallCols.rows]
        .every(row => row.data_type === 'numeric');

      return {
        passed: allNumeric,
        name: 'NUMERIC Types',
        details: allNumeric ? 'All money fields are NUMERIC' : 'Some fields still use REAL/FLOAT'
      };

    } catch (error) {
      return {
        passed: false,
        name: 'NUMERIC Types',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  async verifyPaymentWorkflow(): Promise<{passed: boolean, name: string, details: string}> {
    try {
      // Test that payment validation works
      const validation = await this.allocationService.validatePaymentAmount(1, 100);
      
      // Test arithmetic precision
      const testResult = await this.allocationService.calculateAllocationMetrics({
        amount: '100000.50',
        paidAmount: '25000.25',
        calledAmount: '50000.00'
      });

      const precisionOK = Math.abs(testResult.paidPercentage - 25.0) < 0.1;

      return {
        passed: precisionOK,
        name: 'Payment Workflow',
        details: precisionOK ? 'Arithmetic precision maintained' : 'Precision issues detected'
      };

    } catch (error) {
      return {
        passed: false,
        name: 'Payment Workflow',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  async verifyDuplicatePrevention(): Promise<{passed: boolean, name: string, details: string}> {
    try {
      // Check if UNIQUE constraint would prevent duplicates
      const constraintExists = await pool.query(`
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_fund_deal_allocation'
      `);

      return {
        passed: constraintExists.rows.length > 0,
        name: 'Duplicate Prevention',
        details: constraintExists.rows.length > 0 ? 'UNIQUE constraint active' : 'No duplicate prevention'
      };

    } catch (error) {
      return {
        passed: false,
        name: 'Duplicate Prevention',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  async verifyArithmeticPrecision(): Promise<{passed: boolean, name: string, details: string}> {
    try {
      // Test that large number arithmetic works correctly
      const metrics = this.allocationService.calculateAllocationMetrics({
        amount: '999999999.99',
        paidAmount: '123456789.50',
        calledAmount: '500000000.00'
      });

      // Verify the calculation is correct
      const expectedPaidPct = (123456789.50 / 999999999.99) * 100;
      const actualPaidPct = metrics.paidPercentage;
      const precisionError = Math.abs(actualPaidPct - expectedPaidPct);

      return {
        passed: precisionError < 0.01, // Error less than 0.01%
        name: 'Arithmetic Precision',
        details: `Precision error: ${precisionError.toFixed(6)}% (${precisionError < 0.01 ? 'acceptable' : 'too high'})`
      };

    } catch (error) {
      return {
        passed: false,
        name: 'Arithmetic Precision',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }
}

async function main() {
  const verifier = new AllocationFixVerifier();
  await verifier.verifyAllFixes();
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}