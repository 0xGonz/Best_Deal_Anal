#!/usr/bin/env tsx

import { DatabaseStorage } from '../server/database-storage';

/**
 * Fix existing distribution data by recalculating allocation metrics
 * This will update the distributionPaid field for allocations that have distributions
 */

async function fixExistingDistributions() {
  const storage = new DatabaseStorage();
  
  try {
    console.log('🔧 Fixing existing distribution data...');
    
    // Get all allocations that have distributions
    const db = storage.getDbClient();
    const { distributions, fundAllocations, deals } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const allocationsWithDistributions = await db
      .select({
        id: fundAllocations.id,
        dealId: fundAllocations.dealId,
        dealName: deals.name
      })
      .from(fundAllocations)
      .innerJoin(distributions, eq(fundAllocations.id, distributions.allocationId))
      .innerJoin(deals, eq(fundAllocations.dealId, deals.id))
      .groupBy(fundAllocations.id, fundAllocations.dealId, deals.name);
    
    console.log(`📊 Found ${allocationsWithDistributions.length} allocations with distributions`);
    
    // Recalculate metrics for each allocation
    for (const alloc of allocationsWithDistributions) {
      console.log(`🔄 Recalculating metrics for allocation ${alloc.id} (${alloc.dealName})`);
      await storage.recalculateAllocationMetrics(alloc.id);
    }
    
    console.log('✅ Successfully updated all allocation metrics');
    
    // Verify the updates
    const verificationResults = await db.query(`
      SELECT 
        fa.id,
        d.name as deal_name,
        fa.distribution_paid,
        COALESCE(SUM(dist.amount::numeric), 0) as total_distributions
      FROM fund_allocations fa
      JOIN deals d ON fa.deal_id = d.id
      LEFT JOIN distributions dist ON fa.id = dist.allocation_id
      WHERE fa.distribution_paid > 0 OR dist.id IS NOT NULL
      GROUP BY fa.id, d.name, fa.distribution_paid
      ORDER BY fa.id
    `);
    
    console.log('\n📈 Verification Results:');
    for (const result of verificationResults.rows) {
      console.log(`  Allocation ${result.id} (${result.deal_name}): distributionPaid=${result.distribution_paid}, actualDistributions=${result.total_distributions}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing distributions:', error);
    throw error;
  }
}

async function main() {
  try {
    await fixExistingDistributions();
    console.log('\n🎉 All done! Distribution data has been synchronized.');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}