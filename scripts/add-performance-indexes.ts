/**
 * Performance optimization script
 * Adds database indexes to eliminate slow queries identified in the analysis
 */

import { db } from '../server/db';

async function addPerformanceIndexes() {
  
  console.log('🚀 Adding performance indexes...');
  
  try {
    // Index for deal queries by stage
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_deals_stage 
      ON deals(stage);
    `);
    
    // Index for deal queries by creation date
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_deals_created_at 
      ON deals(created_at);
    `);
    
    // Index for fund allocations by fund_id
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fund_allocations_fund_id 
      ON fund_allocations(fund_id);
    `);
    
    // Index for fund allocations by deal_id
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fund_allocations_deal_id 
      ON fund_allocations(deal_id);
    `);
    
    // Index for fund allocations by status
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fund_allocations_status 
      ON fund_allocations(status);
    `);
    
    // Composite index for fund allocations queries
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fund_allocations_fund_status 
      ON fund_allocations(fund_id, status);
    `);
    
    // Index for capital calls by allocation_id
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_capital_calls_allocation_id 
      ON capital_calls(allocation_id);
    `);
    
    // Index for capital calls by due_date
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_capital_calls_due_date 
      ON capital_calls(due_date);
    `);
    
    // Index for payments by capital_call_id
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_payments_capital_call_id 
      ON payments(capital_call_id);
    `);
    
    // Index for timeline events (activity replacement)
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_timeline_events_created_at 
      ON timeline_events(created_at DESC);
    `);
    
    // Index for timeline events by deal_id
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_timeline_events_deal_id 
      ON timeline_events(deal_id);
    `);
    
    // Index for users by role
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_users_role 
      ON users(role);
    `);
    
    // Index for sessions optimization
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_session_expire 
      ON session(expire);
    `);
    
    console.log('✅ Performance indexes added successfully');
    
    // Analyze tables to update statistics
    console.log('📊 Updating table statistics...');
    
    await db.execute(`ANALYZE deals;`);
    await db.execute(`ANALYZE fund_allocations;`);
    await db.execute(`ANALYZE capital_calls;`);
    await db.execute(`ANALYZE payments;`);
    await db.execute(`ANALYZE timeline_events;`);
    await db.execute(`ANALYZE users;`);
    await db.execute(`ANALYZE funds;`);
    
    console.log('✅ Table statistics updated');
    
    // Show index usage
    const indexInfo = await db.execute(`
      SELECT schemaname, tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('deals', 'fund_allocations', 'capital_calls', 'payments', 'timeline_events', 'users', 'funds')
      ORDER BY tablename, indexname;
    `);
    
    console.log('\n📋 Current indexes:');
    indexInfo.forEach((index: any) => {
      console.log(`  ${index.tablename}.${index.indexname}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    throw error;
  }
}

async function main() {
  try {
    await addPerformanceIndexes();
    console.log('\n🎉 Performance optimization completed successfully');
  } catch (error) {
    console.error('💥 Performance optimization failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
main();

export { addPerformanceIndexes };