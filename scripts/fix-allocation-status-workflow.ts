/**
 * This script fixes the allocation status workflow by:
 * 1. Recalculating all allocation statuses based on actual payment amounts
 * 2. Ensuring status consistency between committed vs paid amounts
 * 3. Applying the AllocationStatusService logic systematically
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { fundAllocations } from '../shared/schema.js';
import { AllocationStatusService } from '../server/services/allocation-status.service.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function main() {
  try {
    console.log('🔍 Starting allocation status workflow fix...');
    
    // Get all allocations
    const allocations = await db.select().from(fundAllocations);
    console.log(`Found ${allocations.length} allocations to check`);
    
    let fixedCount = 0;
    
    for (const allocation of allocations) {
      const currentData = {
        amount: allocation.amount,
        paidAmount: allocation.paidAmount,
        status: allocation.status
      };
      
      // Calculate what the status should be
      const correctStatus = AllocationStatusService.calculateStatus(currentData);
      
      // Check if status needs to be corrected
      if (allocation.status !== correctStatus.status) {
        console.log(`Fixing allocation ${allocation.id}: ${allocation.status} → ${correctStatus.status}`);
        console.log(`  Amount: $${allocation.amount?.toLocaleString()}, Paid: $${(allocation.paidAmount || 0).toLocaleString()}`);
        
        // Update the allocation with correct status
        await db
          .update(fundAllocations)
          .set({ status: correctStatus.status })
          .where(eq(fundAllocations.id, allocation.id));
        
        fixedCount++;
      } else {
        console.log(`✓ Allocation ${allocation.id} status is correct: ${allocation.status}`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} allocation status inconsistencies`);
    console.log('Status workflow is now consistent across all allocations');
    
  } catch (error) {
    console.error('❌ Error fixing allocation status workflow:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Import eq function
import { eq } from 'drizzle-orm';

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}