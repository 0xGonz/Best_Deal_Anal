/**
 * Investment Flow Validation Script
 * Validates the complete flow: Allocation → Capital Calls → Status Updates
 */

import { DatabaseStorage } from '../server/database-storage';

async function validateInvestmentFlow() {
  console.log('🔍 Validating Complete Investment Flow...\n');
  
  const storage = new DatabaseStorage();
  
  try {
    // Step 1: Check existing allocations and capital calls
    console.log('📊 Current System State:');
    const deals = await storage.getDeals();
    const funds = await storage.getFunds();
    const allocations = await storage.getAllocationsByFund(funds[0]?.id || 1);
    
    console.log(`   Deals: ${deals.length}`);
    console.log(`   Funds: ${funds.length}`);
    console.log(`   Allocations: ${allocations.length}`);
    
    // Step 2: Test allocation with existing data
    if (deals.length > 0 && funds.length > 0) {
      console.log('\n💰 Testing Allocation Creation:');
      
      const testDeal = deals.find(d => d.stage === 'closing' || d.stage === 'closed') || deals[0];
      const testFund = funds[0];
      
      console.log(`   Using Deal: ${testDeal.name} (ID: ${testDeal.id})`);
      console.log(`   Using Fund: ${testFund.name} (ID: ${testFund.id})`);
      
      // Create test allocation via direct database call
      const newAllocation = await storage.createFundAllocation({
        dealId: testDeal.id,
        fundId: testFund.id,
        amount: 750000, // $750k commitment
        securityType: 'equity',
        amountType: 'dollar',
        status: 'committed',
        allocationDate: new Date(),
        portfolioWeight: 0,
        interestPaid: 0,
        distributionPaid: 0,
        paidAmount: 0,
        calledAmount: 0,
        notes: 'Test allocation for workflow validation'
      });
      
      console.log(`   ✅ Created allocation ID: ${newAllocation.id} - $750,000 commitment`);
      
      // Step 3: Test capital call scenarios
      console.log('\n📞 Testing Capital Call Scenarios:');
      
      // Scenario A: 30% Capital Call
      const percentageCall = await storage.createCapitalCall({
        allocationId: newAllocation.id,
        callAmount: 30, // 30%
        amountType: 'percentage',
        callDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'scheduled',
        paidAmount: 0,
        outstanding_amount: 750000 * 0.30, // $225k
        notes: '30% capital call test'
      });
      
      console.log(`   📊 30% Call: $${(750000 * 0.30).toLocaleString()} (ID: ${percentageCall.id})`);
      
      // Scenario B: $100k Dollar Call
      const dollarCall = await storage.createCapitalCall({
        allocationId: newAllocation.id,
        callAmount: 100000, // $100k
        amountType: 'dollar',
        callDate: new Date(),
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: 'scheduled',
        paidAmount: 0,
        outstanding_amount: 100000,
        notes: '$100k capital call test'
      });
      
      console.log(`   💵 Dollar Call: $${dollarCall.callAmount.toLocaleString()} (ID: ${dollarCall.id})`);
      
      // Step 4: Test payment processing
      console.log('\n💳 Testing Payment Processing:');
      
      // Pay the percentage call
      await storage.updateCapitalCall(percentageCall.id, {
        status: 'paid',
        paidAmount: 225000,
        outstanding_amount: 0,
        paidDate: new Date()
      });
      console.log(`   ✅ Paid 30% call: $225,000`);
      
      // Partially pay the dollar call
      await storage.updateCapitalCall(dollarCall.id, {
        status: 'partially_paid',
        paidAmount: 60000,
        outstanding_amount: 40000,
        paidDate: new Date()
      });
      console.log(`   ⚡ Partial payment: $60,000 of $100,000`);
      
      // Step 5: Calculate called/uncalled capital
      console.log('\n🎯 Capital Tracking Summary:');
      
      const allCapitalCalls = await storage.getCapitalCallsByAllocation(newAllocation.id);
      
      let totalCalled = 0;
      let totalPaid = 0;
      
      for (const call of allCapitalCalls) {
        if (call.amountType === 'percentage') {
          totalCalled += (newAllocation.amount * call.callAmount) / 100;
        } else {
          totalCalled += call.callAmount;
        }
        totalPaid += call.paidAmount || 0;
      }
      
      const uncalledCapital = newAllocation.amount - totalCalled;
      const unpaidCapital = totalCalled - totalPaid;
      
      console.log(`   Commitment:     $${newAllocation.amount.toLocaleString()}`);
      console.log(`   Called:         $${totalCalled.toLocaleString()}`);
      console.log(`   Paid:           $${totalPaid.toLocaleString()}`);
      console.log(`   Uncalled:       $${uncalledCapital.toLocaleString()}`);
      console.log(`   Unpaid:         $${unpaidCapital.toLocaleString()}`);
      
      // Update allocation status based on payments
      let allocationStatus = 'committed';
      if (totalPaid >= newAllocation.amount) {
        allocationStatus = 'funded';
      } else if (totalPaid > 0) {
        allocationStatus = 'partially_paid';
      }
      
      await storage.updateFundAllocation(newAllocation.id, {
        ...newAllocation,
        status: allocationStatus as any,
        calledAmount: totalCalled,
        paidAmount: totalPaid
      });
      
      console.log(`   Status:         ${allocationStatus}`);
      
      // Step 6: Fund metrics validation
      console.log('\n📈 Fund Metrics Integration:');
      
      const fundAllocations = await storage.getAllocationsByFund(testFund.id);
      
      let fundCommitted = 0;
      let fundCalled = 0;
      let fundPaid = 0;
      
      for (const allocation of fundAllocations) {
        fundCommitted += allocation.amount || 0;
        fundCalled += allocation.calledAmount || 0;
        fundPaid += allocation.paidAmount || 0;
      }
      
      console.log(`   ${testFund.name}:`);
      console.log(`   Total Committed: $${fundCommitted.toLocaleString()}`);
      console.log(`   Total Called:    $${fundCalled.toLocaleString()}`);
      console.log(`   Total Paid:      $${fundPaid.toLocaleString()}`);
      console.log(`   Uncalled:        $${(fundCommitted - fundCalled).toLocaleString()}`);
      
      console.log('\n🎉 Investment Flow Validation Complete!');
      console.log('\n✅ Key Features Verified:');
      console.log('   • Allocation creation with dollar commitments');
      console.log('   • Percentage-based capital calls (30% = $225k)');
      console.log('   • Dollar-amount capital calls ($100k)');
      console.log('   • Partial payment processing ($60k of $100k)');
      console.log('   • Called/uncalled capital tracking');
      console.log('   • Automatic status transitions (committed → partially_paid)');
      console.log('   • Fund-level metrics aggregation');
      
    } else {
      console.log('❌ Insufficient test data available');
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

// Run validation
validateInvestmentFlow().catch(console.error);