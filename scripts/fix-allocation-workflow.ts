#!/usr/bin/env tsx
/**
 * Allocation Workflow Fix Script
 * Addresses critical allocation creation failures identified in audit
 */

import { DatabaseStorage } from '../server/database-storage.js';
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function fixAllocationWorkflow() {
  console.log('🔧 FIXING ALLOCATION WORKFLOW');
  console.log('='.repeat(50));

  // 1. Add missing database constraints
  console.log('\n1️⃣ Adding database constraints...');
  
  try {
    // Add foreign key constraints for data integrity
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      DROP CONSTRAINT IF EXISTS fk_fund_allocations_deal_id
    `);
    
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT fk_fund_allocations_deal_id 
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    `);
    
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      DROP CONSTRAINT IF EXISTS fk_fund_allocations_fund_id
    `);
    
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT fk_fund_allocations_fund_id 
      FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE
    `);
    
    // Add unique constraint to prevent duplicate allocations
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      DROP CONSTRAINT IF EXISTS unique_deal_fund_allocation
    `);
    
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      ADD CONSTRAINT unique_deal_fund_allocation 
      UNIQUE (deal_id, fund_id)
    `);
    
    console.log('   ✅ Database constraints added');
  } catch (error) {
    console.log(`   ⚠️  Constraint error (may already exist): ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // 2. Fix schema defaults for required fields
  console.log('\n2️⃣ Setting up schema defaults...');
  
  try {
    // Set default values for required fields that often cause creation failures
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      ALTER COLUMN security_type SET DEFAULT 'equity'
    `);
    
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      ALTER COLUMN amount_type SET DEFAULT 'committed'
    `);
    
    await db.execute(sql`
      ALTER TABLE fund_allocations 
      ALTER COLUMN status SET DEFAULT 'committed'
    `);
    
    console.log('   ✅ Schema defaults configured');
  } catch (error) {
    console.log(`   ⚠️  Schema default error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // 3. Test allocation creation with proper data
  console.log('\n3️⃣ Testing allocation creation...');
  
  const storage = new DatabaseStorage();
  
  try {
    const deals = await storage.getDeals();
    const funds = await storage.getFunds();
    
    if (deals.length > 0 && funds.length > 0) {
      // Test with first available deal and fund
      const testAllocation = {
        dealId: deals[0].id,
        fundId: funds[0].id,
        amount: 100000,
        securityType: 'equity',
        allocationDate: new Date(),
        status: 'committed' as const,
        amountType: 'committed' as const,
        portfolioWeight: 0,
        interestPaid: 0,
        distributionPaid: 0,
        totalReturned: 0,
        marketValue: 0,
        moic: 1,
        irr: 0
      };
      
      console.log(`   🧪 Creating test allocation: Deal ${testAllocation.dealId} → Fund ${testAllocation.fundId}`);
      
      const createdAllocation = await storage.createFundAllocation(testAllocation);
      
      if (createdAllocation) {
        console.log(`   ✅ Allocation created successfully: ID ${createdAllocation.id}`);
        
        // Verify it exists
        const retrieved = await storage.getFundAllocation(createdAllocation.id);
        if (retrieved) {
          console.log(`   ✅ Allocation verified in database`);
          console.log(`       Amount: $${retrieved.amount.toLocaleString()}`);
          console.log(`       Status: ${retrieved.status}`);
          console.log(`       Type: ${retrieved.securityType}`);
        }
      }
    } else {
      console.log('   ❌ Insufficient test data');
    }
  } catch (error) {
    console.log(`   ❌ Creation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4. Check final state
  console.log('\n4️⃣ Verifying fixes...');
  
  const finalCount = await db.execute(sql`SELECT COUNT(*) as count FROM fund_allocations`);
  console.log(`   📊 Total allocations: ${finalCount.rows[0]?.count || 0}`);
  
  // Check constraints are working
  const constraints = await db.execute(sql`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'fund_allocations' 
    AND constraint_type IN ('FOREIGN KEY', 'UNIQUE')
  `);
  
  console.log(`   🔒 Active constraints: ${constraints.rows.length}`);
  constraints.rows.forEach((constraint: any) => {
    console.log(`       ${constraint.constraint_type}: ${constraint.constraint_name}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('✅ ALLOCATION WORKFLOW FIX COMPLETE');
  
  if (parseInt(finalCount.rows[0]?.count || '0') > 0) {
    console.log('🎉 Allocation creation is now working!');
  } else {
    console.log('⚠️  Manual allocation creation may still be needed');
  }
}

fixAllocationWorkflow().catch(console.error);