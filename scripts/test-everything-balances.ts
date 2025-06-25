/**
 * Test Suite for "Everything Has to Balance" Implementation
 * 
 * Runs the smoke test from the playbook to validate the system works correctly
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

interface TestResult {
  step: number;
  description: string;
  success: boolean;
  data?: any;
  error?: string;
}

class EverythingBalancesTestSuite {
  private results: TestResult[] = [];
  private testAllocationId: number | null = null;
  private testCapitalCallId: number | null = null;

  async runSmokeTest(): Promise<void> {
    console.log('🧪 Running "Everything Has to Balance" Smoke Test');
    console.log('=================================================');

    // Step 1: Create test allocation (commit=1,000,000)
    await this.step1_createAllocation();

    // Step 2: Create first capital call (amount=400,000)
    await this.step2_createCapitalCall();

    // Step 3: Make payment (amount=400,000)
    await this.step3_makePayment();

    // Step 4: Create second capital call (600,000)
    await this.step4_createSecondCall();

    // Step 5: Make final payment (600,000)
    await this.step5_makeFinalPayment();

    // Step 6: Verify final state
    await this.step6_verifyFinalState();

    this.printResults();
  }

  private async step1_createAllocation(): Promise<void> {
    try {
      // Create a test deal first
      const dealResult = await pool.query(`
        INSERT INTO deals (name, description, stage, created_by)
        VALUES ('Test Deal - Balance Validation', 'Smoke test deal', 'closed', 1)
        RETURNING id
      `);
      const dealId = dealResult.rows[0].id;

      // Get a test fund
      const fundResult = await pool.query(`
        SELECT id FROM funds LIMIT 1
      `);
      const fundId = fundResult.rows[0]?.id || 1;

      // Create allocation
      const result = await pool.query(`
        INSERT INTO fund_allocations (fund_id, deal_id, amount, status, security_type, allocation_date)
        VALUES ($1, $2, 1000000, 'committed', 'equity', NOW())
        RETURNING id, amount, called_amount, funded_amount, computed_status
      `, [fundId, dealId]);

      this.testAllocationId = result.rows[0].id;

      this.results.push({
        step: 1,
        description: 'Create allocation (commit=1,000,000)',
        success: true,
        data: {
          allocationId: this.testAllocationId,
          amount: result.rows[0].amount,
          calledAmount: result.rows[0].called_amount,
          fundedAmount: result.rows[0].funded_amount,
          status: result.rows[0].computed_status
        }
      });

    } catch (error) {
      this.results.push({
        step: 1,
        description: 'Create allocation (commit=1,000,000)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async step2_createCapitalCall(): Promise<void> {
    try {
      if (!this.testAllocationId) throw new Error('No test allocation ID');

      const result = await pool.query(`
        INSERT INTO capital_calls (allocation_id, call_amount, due_date, status, call_date, outstanding_amount)
        VALUES ($1, 400000, NOW() + INTERVAL '30 days', 'called', NOW(), 400000)
        RETURNING id
      `, [this.testAllocationId]);

      this.testCapitalCallId = result.rows[0].id;

      // Check allocation status
      const allocationResult = await pool.query(`
        SELECT called_amount, computed_status FROM fund_allocations WHERE id = $1
      `, [this.testAllocationId]);

      this.results.push({
        step: 2,
        description: 'Create capital call (amount=400,000)',
        success: true,
        data: {
          capitalCallId: this.testCapitalCallId,
          calledAmount: allocationResult.rows[0].called_amount,
          status: allocationResult.rows[0].computed_status
        }
      });

    } catch (error) {
      this.results.push({
        step: 2,
        description: 'Create capital call (amount=400,000)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async step3_makePayment(): Promise<void> {
    try {
      if (!this.testCapitalCallId) throw new Error('No test capital call ID');

      // Create payment
      await pool.query(`
        INSERT INTO payments (capital_call_id, paid_date, amount_usd)
        VALUES ($1, NOW(), 400000)
      `, [this.testCapitalCallId]);

      // Check allocation status
      const result = await pool.query(`
        SELECT funded_amount, computed_status FROM fund_allocations WHERE id = $1
      `, [this.testAllocationId]);

      this.results.push({
        step: 3,
        description: 'Make payment (amount=400,000)',
        success: true,
        data: {
          fundedAmount: result.rows[0].funded_amount,
          status: result.rows[0].computed_status
        }
      });

    } catch (error) {
      this.results.push({
        step: 3,
        description: 'Make payment (amount=400,000)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async step4_createSecondCall(): Promise<void> {
    try {
      if (!this.testAllocationId) throw new Error('No test allocation ID');

      await pool.query(`
        INSERT INTO capital_calls (allocation_id, call_amount, due_date, status, call_date, outstanding_amount)
        VALUES ($1, 600000, NOW() + INTERVAL '60 days', 'called', NOW(), 600000)
      `, [this.testAllocationId]);

      // Check allocation status
      const result = await pool.query(`
        SELECT called_amount, computed_status FROM fund_allocations WHERE id = $1
      `, [this.testAllocationId]);

      this.results.push({
        step: 4,
        description: 'Create second call (600,000)',
        success: true,
        data: {
          calledAmount: result.rows[0].called_amount,
          status: result.rows[0].computed_status
        }
      });

    } catch (error) {
      this.results.push({
        step: 4,
        description: 'Create second call (600,000)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async step5_makeFinalPayment(): Promise<void> {
    try {
      // Get the second capital call ID
      const callResult = await pool.query(`
        SELECT id FROM capital_calls 
        WHERE allocation_id = $1 AND call_amount = 600000
        ORDER BY id DESC LIMIT 1
      `, [this.testAllocationId]);

      if (callResult.rows.length === 0) throw new Error('Second capital call not found');

      const secondCallId = callResult.rows[0].id;

      // Create payment
      await pool.query(`
        INSERT INTO payments (capital_call_id, paid_date, amount_usd)
        VALUES ($1, NOW(), 600000)
      `, [secondCallId]);

      // Check final allocation status
      const result = await pool.query(`
        SELECT funded_amount, computed_status FROM fund_allocations WHERE id = $1
      `, [this.testAllocationId]);

      this.results.push({
        step: 5,
        description: 'Make final payment (600,000)',
        success: true,
        data: {
          fundedAmount: result.rows[0].funded_amount,
          status: result.rows[0].computed_status
        }
      });

    } catch (error) {
      this.results.push({
        step: 5,
        description: 'Make final payment (600,000)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async step6_verifyFinalState(): Promise<void> {
    try {
      if (!this.testAllocationId) throw new Error('No test allocation ID');

      // Get final state
      const result = await pool.query(`
        SELECT 
          amount,
          called_amount,
          funded_amount,
          computed_status,
          (amount - called_amount) as uncalled_capital,
          (called_amount - funded_amount) as outstanding_calls
        FROM fund_allocations 
        WHERE id = $1
      `, [this.testAllocationId]);

      const state = result.rows[0];
      const isBalanced = 
        parseFloat(state.amount) === 1000000 &&
        parseFloat(state.called_amount) === 1000000 &&
        parseFloat(state.funded_amount) === 1000000 &&
        parseFloat(state.uncalled_capital) === 0 &&
        parseFloat(state.outstanding_calls) === 0 &&
        state.computed_status === 'funded';

      this.results.push({
        step: 6,
        description: 'Verify final state (everything balanced)',
        success: isBalanced,
        data: {
          amount: state.amount,
          calledAmount: state.called_amount,
          fundedAmount: state.funded_amount,
          uncalledCapital: state.uncalled_capital,
          outstandingCalls: state.outstanding_calls,
          status: state.computed_status,
          isFullyBalanced: isBalanced
        }
      });

    } catch (error) {
      this.results.push({
        step: 6,
        description: 'Verify final state (everything balanced)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 Smoke Test Results:');
    console.log('=======================');
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} Step ${result.step}: ${result.description}`);
      if (result.data) {
        console.log(`   Data:`, JSON.stringify(result.data, null, 2));
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n📈 Success Rate: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
    
    if (successCount === totalCount) {
      console.log('\n🎉 SMOKE TEST PASSED! "Everything Has to Balance" system is working correctly!');
      console.log('🔒 Data flows properly: Committed → Called → Funded');
      console.log('📊 Generated columns maintain accurate totals');
      console.log('⚖️  No drift detected - numbers reconcile perfectly');
    } else {
      console.log('\n⚠️  SMOKE TEST FAILED. Issues detected in the balance system.');
    }
  }
}

async function main() {
  const testSuite = new EverythingBalancesTestSuite();
  await testSuite.runSmokeTest();
  await pool.end();
}

main().catch(console.error);