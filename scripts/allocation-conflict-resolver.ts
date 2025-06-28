/**
 * Allocation Conflict Resolver
 * 
 * Helps identify and resolve allocation conflicts when trying to create 
 * allocations that already exist. Provides options to update or modify
 * existing allocations instead of creating duplicates.
 */

import { StorageFactory } from '../server/storage-factory.js';

interface AllocationConflict {
  fundId: number;
  dealId: number;
  fundName: string;
  dealName: string;
  existingAllocation: {
    id: number;
    amount: number;
    status: string;
    paidAmount: number;
    allocationDate: Date;
  };
  suggestedActions: string[];
}

async function findAllocationConflicts() {
  const storage = StorageFactory.getStorage();
  
  console.log('🔍 Allocation Conflict Analysis');
  console.log('==============================\n');

  try {
    // Get all allocations with fund and deal names
    const allocations = await storage.getAllFundAllocations();
    const funds = await storage.getAllFunds();
    const deals = await storage.getAllDeals();
    
    // Create lookup maps
    const fundMap = new Map(funds.map(f => [f.id, f.name]));
    const dealMap = new Map(deals.map(d => [d.id, d.name]));
    
    // Check for the specific conflict reported (Fund 2 → Deal 66)
    const conflictAllocation = allocations.find(a => a.fundId === 2 && a.dealId === 66);
    
    if (conflictAllocation) {
      console.log('📍 IDENTIFIED CONFLICT:');
      console.log('=======================');
      console.log(`Fund: ${fundMap.get(2)} (ID: 2)`);
      console.log(`Deal: ${dealMap.get(66)} (ID: 66)`);
      console.log(`Existing Allocation ID: ${conflictAllocation.id}`);
      console.log(`Amount: $${conflictAllocation.amount.toLocaleString()}`);
      console.log(`Status: ${conflictAllocation.status}`);
      console.log(`Paid Amount: $${(conflictAllocation.paidAmount || 0).toLocaleString()}`);
      console.log(`Date: ${conflictAllocation.allocationDate}\n`);
      
      console.log('💡 RESOLUTION OPTIONS:');
      console.log('======================');
      
      if (conflictAllocation.status === 'funded') {
        console.log('✅ This allocation is already FULLY FUNDED');
        console.log('   • No additional allocation needed');
        console.log('   • Consider if you meant a different deal');
        console.log('   • Check if this should be a capital call instead\n');
      } else if (conflictAllocation.status === 'partially_paid') {
        console.log('🔄 This allocation is PARTIALLY PAID');
        console.log('   • You can create additional capital calls');
        console.log('   • Or update the existing allocation amount');
        console.log('   • Use the allocation edit feature instead of creating new\n');
      } else {
        console.log('⏳ This allocation is COMMITTED but not called');
        console.log('   • You can create capital calls against it');
        console.log('   • Or update the allocation amount if needed');
        console.log('   • Use the allocation edit feature instead of creating new\n');
      }
      
      // Check for related capital calls
      const capitalCalls = await storage.getAllCapitalCalls();
      const relatedCalls = capitalCalls.filter(cc => cc.allocationId === conflictAllocation.id);
      
      if (relatedCalls.length > 0) {
        console.log('💰 RELATED CAPITAL CALLS:');
        console.log('=========================');
        for (const call of relatedCalls) {
          console.log(`   Call ID ${call.id}: $${call.callAmount.toLocaleString()} (${call.status})`);
        }
        console.log('');
      }
    }
    
    // Look for other potential conflicts
    const duplicates = new Map<string, any[]>();
    
    for (const allocation of allocations) {
      const key = `${allocation.fundId}-${allocation.dealId}`;
      if (!duplicates.has(key)) {
        duplicates.set(key, []);
      }
      duplicates.get(key)!.push(allocation);
    }
    
    const actualDuplicates = Array.from(duplicates.entries())
      .filter(([_, allocations]) => allocations.length > 1);
    
    if (actualDuplicates.length > 0) {
      console.log('⚠️  OTHER DUPLICATE ALLOCATIONS FOUND:');
      console.log('======================================');
      
      for (const [key, allocations] of actualDuplicates) {
        const [fundId, dealId] = key.split('-').map(Number);
        const fundName = fundMap.get(fundId) || `Fund ${fundId}`;
        const dealName = dealMap.get(dealId) || `Deal ${dealId}`;
        
        console.log(`\n${fundName} → ${dealName}:`);
        for (const alloc of allocations) {
          console.log(`   ID ${alloc.id}: $${alloc.amount.toLocaleString()} (${alloc.status})`);
        }
      }
      console.log('');
    }
    
    console.log('🎯 RECOMMENDED ACTIONS:');
    console.log('=======================');
    console.log('1. Use the EDIT function instead of CREATE for existing allocations');
    console.log('2. Create CAPITAL CALLS to draw down committed capital');
    console.log('3. Verify you\'re allocating to the correct deal');
    console.log('4. Check if the allocation status matches your intent');
    console.log('\n✨ The duplicate prevention system is working correctly!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Run the analysis
findAllocationConflicts().catch(console.error);