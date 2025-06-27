/**
 * Critical Fixes Script - Phase 1
 * Addresses the most urgent issues identified in the comprehensive audit
 */

import { pool } from '../server/db';

async function applyCriticalFixes() {
  console.log('🔧 Applying critical database fixes...');

  try {
    // Fix 1: Add missing indexes for performance
    console.log('Adding performance indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_fund_allocations_deal_fund 
        ON fund_allocations(deal_id, fund_id);
      
      CREATE INDEX IF NOT EXISTS idx_capital_calls_allocation 
        ON capital_calls(allocation_id);
      
      CREATE INDEX IF NOT EXISTS idx_timeline_events_deal_created 
        ON timeline_events(deal_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_documents_deal_uploaded 
        ON documents(deal_id, uploaded_at DESC);
    `);
    console.log('✅ Performance indexes added');

    // Fix 2: Add data integrity constraints
    console.log('Adding data integrity constraints...');
    await pool.query(`
      DO $$ 
      BEGIN
        -- Prevent negative monetary values
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
            CHECK (call_pct IS NULL OR (call_pct >= 0 AND call_pct <= 100));
        END IF;
        
        -- Prevent duplicate allocations
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'fund_allocations_unique_deal_fund') THEN
          ALTER TABLE fund_allocations 
            ADD CONSTRAINT fund_allocations_unique_deal_fund 
            UNIQUE(deal_id, fund_id);
        END IF;
      END $$;
    `);
    console.log('✅ Data integrity constraints added');

    // Fix 3: Clean up orphaned records
    console.log('Cleaning up orphaned records...');
    const cleanupResult = await pool.query(`
      WITH orphaned_allocations AS (
        DELETE FROM fund_allocations 
        WHERE deal_id NOT IN (SELECT id FROM deals)
        RETURNING id
      ),
      orphaned_capital_calls AS (
        DELETE FROM capital_calls 
        WHERE allocation_id NOT IN (SELECT id FROM fund_allocations)
        RETURNING id
      )
      SELECT 
        (SELECT COUNT(*) FROM orphaned_allocations) as allocations_removed,
        (SELECT COUNT(*) FROM orphaned_capital_calls) as capital_calls_removed;
    `);
    console.log(`✅ Cleaned up orphaned records:`, cleanupResult.rows[0]);

    // Fix 4: Update database statistics
    console.log('Updating database statistics...');
    await pool.query('ANALYZE');
    console.log('✅ Database statistics updated');

    console.log('\n🎉 Critical fixes completed successfully!');
    console.log('Next steps:');
    console.log('1. Remove excessive debug logging from production');
    console.log('2. Consolidate overlapping services');
    console.log('3. Implement query optimization patterns');
    
  } catch (error) {
    console.error('❌ Critical fixes failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await applyCriticalFixes();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
main();