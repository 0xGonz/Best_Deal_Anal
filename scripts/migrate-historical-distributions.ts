/**
 * Historical Distributions Migration Script
 * 
 * This script migrates existing distributions and recalculates allocation metrics
 * to ensure both historical and future distributions are properly tracked.
 */

import { DatabaseStorage } from '../server/database-storage';
import { db } from '../server/db';
import { distributions, fundAllocations, deals } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const storage = new DatabaseStorage();

async function migrateHistoricalDistributions(): Promise<void> {
  console.log('🔧 Starting historical distributions migration...');
  
  try {
    // Step 1: Find all allocations with distributions
    const allocationsWithDistributions = await db
      .select({
        allocationId: fundAllocations.id,
        dealId: fundAllocations.dealId,
        dealName: deals.name,
        fundId: fundAllocations.fundId,
        totalDistributions: sql<number>`COALESCE(SUM(${distributions.amount}), 0)`.as('total_distributions'),
        distributionCount: sql<number>`COUNT(${distributions.id})`.as('distribution_count')
      })
      .from(fundAllocations)
      .leftJoin(distributions, eq(fundAllocations.id, distributions.allocationId))
      .innerJoin(deals, eq(fundAllocations.dealId, deals.id))
      .groupBy(fundAllocations.id, fundAllocations.dealId, deals.name, fundAllocations.fundId)
      .having(sql`COUNT(${distributions.id}) > 0`);

    console.log(`📊 Found ${allocationsWithDistributions.length} allocations with distributions`);

    // Step 2: Recalculate metrics for each allocation
    for (const allocation of allocationsWithDistributions) {
      console.log(`🔄 Processing allocation ${allocation.allocationId} (${allocation.dealName})`);
      console.log(`   - ${allocation.distributionCount} distributions totaling $${allocation.totalDistributions.toLocaleString()}`);
      
      await storage.recalculateAllocationMetrics(allocation.allocationId);
    }

    // Step 3: Verify the migration worked
    console.log('\n✅ Verifying migration results...');
    
    const verificationResults = await db
      .select({
        allocationId: fundAllocations.id,
        dealName: deals.name,
        distributionPaid: fundAllocations.distributionPaid,
        calculatedTotal: sql<number>`COALESCE(SUM(${distributions.amount}), 0)`.as('calculated_total'),
        isConsistent: sql<boolean>`${fundAllocations.distributionPaid} = COALESCE(SUM(${distributions.amount}), 0)`.as('is_consistent')
      })
      .from(fundAllocations)
      .leftJoin(distributions, eq(fundAllocations.id, distributions.allocationId))
      .innerJoin(deals, eq(fundAllocations.dealId, deals.id))
      .groupBy(fundAllocations.id, deals.name, fundAllocations.distributionPaid)
      .having(sql`COUNT(${distributions.id}) > 0`);

    let consistentCount = 0;
    let inconsistentCount = 0;

    for (const result of verificationResults) {
      if (result.isConsistent) {
        consistentCount++;
        console.log(`✅ ${result.dealName}: $${result.distributionPaid?.toLocaleString() || 0} (consistent)`);
      } else {
        inconsistentCount++;
        console.log(`❌ ${result.dealName}: stored=$${result.distributionPaid?.toLocaleString() || 0}, calculated=$${result.calculatedTotal.toLocaleString()}`);
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`   - Processed: ${allocationsWithDistributions.length} allocations`);
    console.log(`   - Consistent: ${consistentCount}`);
    console.log(`   - Inconsistent: ${inconsistentCount}`);
    
    if (inconsistentCount === 0) {
      console.log('🎉 Migration completed successfully! All distributions are now properly tracked.');
    } else {
      console.log('⚠️  Some inconsistencies remain. Manual review may be required.');
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('Initializing database connection...');
  
  try {
    await migrateHistoricalDistributions();
    console.log('✅ Historical distributions migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}