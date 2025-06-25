/**
 * "Everything Has to Balance" Implementation Script
 * 
 * Implements the comprehensive playbook for bulletproof investment tracking:
 * 1. Generated columns for called_amount and funded_amount
 * 2. Database constraints to prevent corruption
 * 3. State machine enforcement
 * 4. Fund capital view for roll-ups
 * 5. Verb-based API structure
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

interface ImplementationResult {
  step: string;
  success: boolean;
  description: string;
  error?: string;
}

class EverythingHasToBalanceImplementer {
  private results: ImplementationResult[] = [];

  async implementAll(): Promise<void> {
    console.log('🚀 Implementing "Everything Has to Balance" System');
    console.log('==================================================');

    // Step 1: Add generated columns to fund_allocations
    await this.addGeneratedColumns();

    // Step 2: Create database constraints
    await this.addDatabaseConstraints();

    // Step 3: Create fund capital view
    await this.createFundCapitalView();

    // Step 4: Add state machine constraints
    await this.addStateMachineConstraints();

    // Step 5: Normalize existing data
    await this.normalizeExistingData();

    // Step 6: Create integrity check functions
    await this.createIntegrityCheckFunctions();

    this.printResults();
  }

  private async addGeneratedColumns(): Promise<void> {
    try {
      // First, convert amount fields to NUMERIC to prevent string concatenation bugs
      await pool.query(`
        ALTER TABLE fund_allocations 
        ALTER COLUMN amount TYPE NUMERIC(18,2),
        ALTER COLUMN paid_amount TYPE NUMERIC(18,2);
      `);

      // Add generated columns exactly as specified in the playbook
      await pool.query(`
        ALTER TABLE fund_allocations
        ADD COLUMN IF NOT EXISTS called_amount NUMERIC(18,2) GENERATED ALWAYS AS
          (COALESCE(
             (SELECT SUM(call_amount) FROM capital_calls c WHERE c.allocation_id = id),0)
          ) STORED,
        ADD COLUMN IF NOT EXISTS funded_amount NUMERIC(18,2) GENERATED ALWAYS AS
          (COALESCE(
             (SELECT SUM(p.amount_usd)
                FROM capital_calls cc
                JOIN payments p ON p.capital_call_id = cc.id
               WHERE cc.allocation_id = id),0)
          ) STORED;
      `);

      this.results.push({
        step: 'Generated Columns',
        success: true,
        description: 'Added called_amount and funded_amount as generated columns'
      });

    } catch (error) {
      this.results.push({
        step: 'Generated Columns',
        success: false,
        description: 'Failed to add generated columns',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async addDatabaseConstraints(): Promise<void> {
    try {
      // Cannot insert a payment without a capital call
      await pool.query(`
        ALTER TABLE payments
        ADD CONSTRAINT IF NOT EXISTS fk_call_required 
        FOREIGN KEY (capital_call_id) REFERENCES capital_calls(id) ON DELETE RESTRICT;
      `);

      // Cannot allocate same deal twice to one fund
      await pool.query(`
        ALTER TABLE fund_allocations
        ADD CONSTRAINT IF NOT EXISTS unique_fund_deal UNIQUE (fund_id, deal_id);
      `);

      // Ensure call_pct is between 0 and 100 if it exists
      await pool.query(`
        ALTER TABLE capital_calls
        ADD CONSTRAINT IF NOT EXISTS check_call_pct_range 
        CHECK (call_pct IS NULL OR (call_pct >= 0 AND call_pct <= 100));
      `);

      // Ensure payment amounts are positive
      await pool.query(`
        ALTER TABLE payments
        ADD CONSTRAINT IF NOT EXISTS check_payment_amount_positive 
        CHECK (amount_usd > 0);
      `);

      // Ensure capital call amounts are positive
      await pool.query(`
        ALTER TABLE capital_calls
        ADD CONSTRAINT IF NOT EXISTS check_call_amount_positive 
        CHECK (call_amount > 0);
      `);

      this.results.push({
        step: 'Database Constraints',
        success: true,
        description: 'Added foreign key and check constraints for data integrity'
      });

    } catch (error) {
      this.results.push({
        step: 'Database Constraints',
        success: false,
        description: 'Failed to add database constraints',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async createFundCapitalView(): Promise<void> {
    try {
      // Create the fund_capital view exactly as specified in the playbook
      await pool.query(`
        CREATE OR REPLACE VIEW fund_capital AS
        SELECT
          f.id,
          f.name,
          SUM(a.amount) AS total_committed,
          SUM(a.called_amount) AS total_called,
          SUM(a.funded_amount) AS total_funded,
          SUM(a.amount - a.called_amount) AS uncalled_capital,
          SUM(a.called_amount - a.funded_amount) AS outstanding_calls
        FROM funds f
        LEFT JOIN fund_allocations a ON a.fund_id = f.id
        GROUP BY f.id, f.name;
      `);

      this.results.push({
        step: 'Fund Capital View',
        success: true,
        description: 'Created fund_capital view for roll-up calculations'
      });

    } catch (error) {
      this.results.push({
        step: 'Fund Capital View',
        success: false,
        description: 'Failed to create fund capital view',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async addStateMachineConstraints(): Promise<void> {
    try {
      // Add computed status column that follows the state machine
      await pool.query(`
        ALTER TABLE fund_allocations
        ADD COLUMN IF NOT EXISTS computed_status TEXT GENERATED ALWAYS AS (
          CASE 
            WHEN called_amount = 0 THEN 'committed'
            WHEN called_amount > 0 AND called_amount < amount THEN 'partially_called'
            WHEN called_amount = amount AND funded_amount = 0 THEN 'called'
            WHEN funded_amount > 0 AND funded_amount < called_amount THEN 'partially_funded'
            WHEN funded_amount = called_amount AND called_amount = amount THEN 'funded'
            ELSE 'committed'
          END
        ) STORED;
      `);

      this.results.push({
        step: 'State Machine Constraints',
        success: true,
        description: 'Added computed_status column following state machine logic'
      });

    } catch (error) {
      this.results.push({
        step: 'State Machine Constraints',
        success: false,
        description: 'Failed to add state machine constraints',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async normalizeExistingData(): Promise<void> {
    try {
      // Fix any existing data inconsistencies
      await pool.query(`
        UPDATE fund_allocations 
        SET status = computed_status 
        WHERE status != computed_status;
      `);

      // Normalize capital call amounts to numeric
      await pool.query(`
        ALTER TABLE capital_calls 
        ALTER COLUMN call_amount TYPE NUMERIC(18,2),
        ALTER COLUMN paid_amount TYPE NUMERIC(18,2);
      `);

      this.results.push({
        step: 'Data Normalization',
        success: true,
        description: 'Normalized existing data to match new constraints'
      });

    } catch (error) {
      this.results.push({
        step: 'Data Normalization',
        success: false,
        description: 'Failed to normalize existing data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async createIntegrityCheckFunctions(): Promise<void> {
    try {
      // Create a function to validate data integrity
      await pool.query(`
        CREATE OR REPLACE FUNCTION check_allocation_integrity()
        RETURNS TABLE(
          allocation_id INTEGER,
          issue_type TEXT,
          description TEXT
        ) AS $$
        BEGIN
          -- Check for allocations where status doesn't match computed status
          RETURN QUERY
          SELECT 
            fa.id,
            'status_mismatch'::TEXT,
            'Status does not match computed status'::TEXT
          FROM fund_allocations fa
          WHERE fa.status != fa.computed_status;

          -- Check for payments without capital calls
          RETURN QUERY
          SELECT 
            NULL::INTEGER,
            'orphaned_payment'::TEXT,
            'Payment exists without valid capital call'::TEXT
          FROM payments p
          WHERE NOT EXISTS (
            SELECT 1 FROM capital_calls cc WHERE cc.id = p.capital_call_id
          );

          -- Check for negative amounts
          RETURN QUERY
          SELECT 
            fa.id,
            'negative_amount'::TEXT,
            'Allocation has negative amount'::TEXT
          FROM fund_allocations fa
          WHERE fa.amount < 0;

        END;
        $$ LANGUAGE plpgsql;
      `);

      this.results.push({
        step: 'Integrity Check Functions',
        success: true,
        description: 'Created check_allocation_integrity() function for monitoring'
      });

    } catch (error) {
      this.results.push({
        step: 'Integrity Check Functions',
        success: false,
        description: 'Failed to create integrity check functions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 Implementation Results:');
    console.log('==========================');
    
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.step}: ${result.description}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n📈 Success Rate: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
    
    if (successCount === totalCount) {
      console.log('\n🎉 "Everything Has to Balance" system successfully implemented!');
      console.log('🔒 Data integrity is now enforced at the database level');
      console.log('📊 Use the fund_capital view for accurate roll-ups');
      console.log('🔍 Run SELECT * FROM check_allocation_integrity() to validate data');
    } else {
      console.log('\n⚠️  Some steps failed. Review errors above and retry.');
    }
  }
}

async function main() {
  const implementer = new EverythingHasToBalanceImplementer();
  await implementer.implementAll();
  await pool.end();
}

main().catch(console.error);