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
    
    // Index for activity feed queries
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_activity_created_at 
      ON activity(created_at DESC);
    `);
    
    // Index for activity by deal_id
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_activity_deal_id 
      ON activity(deal_id);
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
    
    await storage.db.execute(`ANALYZE deals;`);
    await storage.db.execute(`ANALYZE fund_allocations;`);
    await storage.db.execute(`ANALYZE capital_calls;`);
    await storage.db.execute(`ANALYZE payments;`);
    await storage.db.execute(`ANALYZE activity;`);
    await storage.db.execute(`ANALYZE users;`);
    await storage.db.execute(`ANALYZE funds;`);
    
    console.log('✅ Table statistics updated');
    
    // Show index usage
    const indexInfo = await storage.db.execute(`
      SELECT schemaname, tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('deals', 'fund_allocations', 'capital_calls', 'payments', 'activity', 'users', 'funds')
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

if (require.main === module) {
  main();
}

export { addPerformanceIndexes };