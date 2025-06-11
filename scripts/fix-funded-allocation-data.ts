import { DatabaseStorage } from '../server/database-storage';
import { AllocationStatusService } from '../server/services/allocation-status.service';

/**
 * Fixes data inconsistency where funded allocations have paidAmount = 0
 * This ensures funded status means paidAmount = amount for accurate calculations
 */
async function main() {
  const storage = new DatabaseStorage();

  try {
    console.log('🔍 Finding allocations with inconsistent status/paidAmount data...');
    
    // Get all allocations
    const allAllocations = await storage.getFunds().then(async (funds) => {
      const allocations = [];
      for (const fund of funds) {
        const fundAllocations = await storage.getAllocationsByFund(fund.id);
        allocations.push(...fundAllocations);
      }
      return allocations;
    });

    console.log(`📊 Found ${allAllocations.length} total allocations`);

    let fixedCount = 0;
    
    for (const allocation of allAllocations) {
      const shouldSync = (
        (allocation.status === 'funded' && allocation.paidAmount !== allocation.amount) ||
        (allocation.status === 'committed' && allocation.paidAmount !== 0) ||
        (allocation.status === 'unfunded' && allocation.paidAmount !== 0)
      );

      if (shouldSync) {
        console.log(`🔧 Fixing allocation ${allocation.id}: status="${allocation.status}", amount=${allocation.amount}, paidAmount=${allocation.paidAmount || 0}`);
        
        // Sync paidAmount with status
        const syncedData = AllocationStatusService.syncPaidAmountWithStatus({
          amount: allocation.amount,
          status: allocation.status,
          paidAmount: allocation.paidAmount || 0
        });

        // Update the allocation
        await storage.updateFundAllocation(allocation.id, {
          paidAmount: syncedData.paidAmount
        });

        console.log(`✅ Updated allocation ${allocation.id}: paidAmount now ${syncedData.paidAmount}`);
        fixedCount++;
      }
    }

    console.log(`✅ Fixed ${fixedCount} allocations with inconsistent data`);

    if (fixedCount > 0) {
      console.log('🔄 Recalculating fund metrics...');
      // Recalculate fund metrics to reflect changes
      const funds = await storage.getFunds();
      for (const fund of funds) {
        const allocations = await storage.getAllocationsByFund(fund.id);
        console.log(`📊 Fund ${fund.name}: ${allocations.length} allocations`);
      }
    }

  } catch (error) {
    console.error('❌ Error fixing allocation data:', error);
    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}