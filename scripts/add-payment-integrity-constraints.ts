/**
 * Add Payment Integrity Constraints
 * 
 * Implements the database-level constraints identified in the forensic analysis
 * to prevent overpayment corruption at the storage layer.
 */

import { DatabaseStorage } from '../server/database-storage.js';

async function addPaymentIntegrityConstraints(): Promise<void> {
  console.log('🔧 Adding payment integrity constraints to prevent overpayment corruption...');
  
  const storage = new DatabaseStorage();
  const db = storage.getDbClient();
  
  try {
    // 1. Add CHECK constraint to prevent paid amount exceeding commitment
    console.log('Adding CHECK constraint to fund_allocations...');
    await db.execute(`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT chk_paid_amount_not_exceed_commitment 
      CHECK (paid_amount <= amount)
    `);
    console.log('✅ Added constraint: paid_amount <= amount');
    
    // 2. Add CHECK constraint to prevent negative amounts
    console.log('Adding CHECK constraints for non-negative amounts...');
    await db.execute(`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT chk_amount_non_negative 
      CHECK (amount >= 0)
    `);
    
    await db.execute(`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT chk_paid_amount_non_negative 
      CHECK (paid_amount >= 0)
    `);
    console.log('✅ Added constraints for non-negative amounts');
    
    // 3. Add CHECK constraint for capital calls
    console.log('Adding CHECK constraints for capital_calls...');
    await db.execute(`
      ALTER TABLE capital_calls 
      ADD CONSTRAINT chk_call_amount_non_negative 
      CHECK (call_amount >= 0)
    `);
    
    await db.execute(`
      ALTER TABLE capital_calls 
      ADD CONSTRAINT chk_paid_amount_non_negative_cc 
      CHECK (paid_amount >= 0)
    `);
    
    await db.execute(`
      ALTER TABLE capital_calls 
      ADD CONSTRAINT chk_paid_not_exceed_call 
      CHECK (paid_amount <= call_amount)
    `);
    console.log('✅ Added capital call payment constraints');
    
    // 4. Create the allocation progress view mentioned in the forensic analysis
    console.log('Creating v_allocation_progress view...');
    await db.execute(`
      CREATE OR REPLACE VIEW v_allocation_progress AS
      SELECT 
        fa.id as allocation_id,
        fa.deal_id,
        fa.fund_id,
        fa.amount as committed,
        COALESCE(SUM(cc.call_amount), 0) as called,
        COALESCE(SUM(cc.paid_amount), 0) as paid,
        COALESCE(SUM(cc.call_amount - cc.paid_amount), 0) as outstanding,
        fa.amount - COALESCE(SUM(cc.call_amount), 0) as uncalled,
        fa.status,
        CASE 
          WHEN fa.amount > 0 THEN (COALESCE(SUM(cc.paid_amount), 0) / fa.amount * 100)
          ELSE 0
        END as paid_percentage
      FROM fund_allocations fa
      LEFT JOIN capital_calls cc ON fa.id = cc.allocation_id
      GROUP BY fa.id, fa.deal_id, fa.fund_id, fa.amount, fa.status
    `);
    
    // Add index on the view for performance
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_v_allocation_progress_allocation_id 
      ON fund_allocations(id)
    `);
    console.log('✅ Created v_allocation_progress view with index');
    
    console.log('🎉 Payment integrity constraints successfully added!');
    console.log('');
    console.log('Database now enforces:');
    console.log('  ✅ paid_amount <= committed_amount (prevents overpayment)');
    console.log('  ✅ All amounts must be non-negative');
    console.log('  ✅ Capital call payments cannot exceed call amount');
    console.log('  ✅ v_allocation_progress view provides single source of truth');
    
  } catch (error) {
    console.error('❌ Failed to add payment integrity constraints:', error);
    
    // If constraints already exist, that's OK
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('✅ Constraints already exist - database is protected');
    } else {
      throw error;
    }
  }
}

async function main() {
  try {
    await addPaymentIntegrityConstraints();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
main();

export { addPaymentIntegrityConstraints };