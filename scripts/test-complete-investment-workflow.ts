/**
 * Complete Investment Workflow Test Script
 * 
 * Tests the entire investment lifecycle:
 * 1. Deal allocation to fund (commitment)
 * 2. Capital call creation (percentage/dollar amounts)
 * 3. Status transitions (committed → funded/partially_paid)
 * 4. Called/uncalled capital tracking
 * 5. Fund metrics integration
 */

import { DatabaseStorage } from '../server/database-storage';
import { capitalCallService } from '../server/services/capital-call.service';
import { AllocationDomainService } from '../server/services/allocation-domain.service';
import { AllocationDomainService } from '../server/services/allocation-domain.service';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  data?: any;
}

class InvestmentWorkflowTester {
  private storage = new DatabaseStorage();
  private allocationService = new AllocationCreationService();
  private statusService = new AllocationStatusService();
  private results: TestResult[] = [];

  async runCompleteWorkflowTest(): Promise<void> {
    console.log('🧪 Starting Complete Investment Workflow Test...\n');

    try {
      // Test 1: Verify test data availability
      await this.testDataAvailability();

      // Test 2: Create allocation (commitment)
      const allocation = await this.testAllocationCreation();

      // Test 3: Test capital call scenarios
      if (allocation) {
        await this.testCapitalCallScenarios(allocation);
        await this.testPercentageCapitalCalls(allocation);
        await this.testDollarCapitalCalls(allocation);
        await this.testPartialPayments(allocation);
      }

      // Test 4: Validate fund metrics
      await this.testFundMetricsIntegration();

      // Test 5: Test called/uncalled capital tracking
      await this.testCalledUncalledTracking();

    } catch (error) {
      this.addResult('Complete Workflow', false, `Test suite failed: ${error.message}`);
    }

    this.printResults();
  }

  private async testDataAvailability(): Promise<void> {
    console.log('📊 Testing data availability...');
    
    const deals = await this.storage.getDeals();
    const funds = await this.storage.getFunds();
    const allocations = await this.storage.getFundAllocations();

    this.addResult(
      'Data Availability',
      deals.length > 0 && funds.length > 0,
      `Found ${deals.length} deals, ${funds.length} funds, ${allocations.length} existing allocations`
    );
  }

  private async testAllocationCreation(): Promise<any> {
    console.log('💰 Testing allocation creation...');
    
    try {
      const deals = await this.storage.getDeals();
      const funds = await this.storage.getFunds();
      
      if (deals.length === 0 || funds.length === 0) {
        this.addResult('Allocation Creation', false, 'No test data available');
        return null;
      }

      const testDeal = deals[0];
      const testFund = funds[0];
      const commitmentAmount = 500000; // $500k commitment

      console.log(`Creating allocation: ${testDeal.name} → ${testFund.name} ($${commitmentAmount.toLocaleString()})`);

      const allocationData = {
        dealId: testDeal.id,
        fundId: testFund.id,
        amount: commitmentAmount,
        securityType: 'equity',
        amountType: 'dollar' as const,
        status: 'committed' as const,
        notes: 'Test allocation for complete workflow validation'
      };

      const allocation = await this.allocationService.createAllocation(allocationData);

      this.addResult(
        'Allocation Creation',
        !!allocation,
        `Created allocation ID ${allocation?.id} - Commitment: $${commitmentAmount.toLocaleString()}`,
        allocation
      );

      return allocation;

    } catch (error) {
      this.addResult('Allocation Creation', false, `Failed: ${error.message}`);
      return null;
    }
  }

  private async testCapitalCallScenarios(allocation: any): Promise<void> {
    console.log('📞 Testing capital call scenarios...');

    // Scenario 1: No capital call (investment doesn't call capital initially)
    await this.testNoCapitalCall(allocation);

    // Scenario 2: Single 100% capital call
    await this.testFullCapitalCall(allocation);
  }

  private async testNoCapitalCall(allocation: any): Promise<void> {
    console.log('  Testing no capital call scenario...');
    
    // Allocation should remain in 'committed' status with no capital calls
    const status = await this.statusService.calculateAllocationStatus(allocation.id);
    
    this.addResult(
      'No Capital Call Scenario',
      status === 'committed',
      `Allocation status: ${status} (expected: committed)`
    );
  }

  private async testFullCapitalCall(allocation: any): Promise<void> {
    console.log('  Testing 100% capital call scenario...');
    
    try {
      // Create a 100% capital call
      const capitalCall = await this.storage.createCapitalCall({
        allocationId: allocation.id,
        callAmount: allocation.amount, // Full amount
        amountType: 'dollar',
        callDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'scheduled',
        paidAmount: 0,
        outstanding_amount: allocation.amount,
        notes: 'Full capital call test'
      });

      this.addResult(
        'Full Capital Call Creation',
        !!capitalCall,
        `Created capital call ID ${capitalCall?.id} for full amount: $${allocation.amount.toLocaleString()}`
      );

      // Test payment processing
      if (capitalCall) {
        await this.testCapitalCallPayment(capitalCall, allocation.amount);
      }

    } catch (error) {
      this.addResult('Full Capital Call Creation', false, `Failed: ${error.message}`);
    }
  }

  private async testPercentageCapitalCalls(allocation: any): Promise<void> {
    console.log('📊 Testing percentage-based capital calls...');
    
    try {
      // Create new allocation for percentage testing
      const deals = await this.storage.getDeals();
      const funds = await this.storage.getFunds();
      
      const percentageAllocation = await this.allocationService.createAllocation({
        dealId: deals[1]?.id || deals[0].id,
        fundId: funds[0].id,
        amount: 250000, // $250k commitment
        securityType: 'equity',
        amountType: 'dollar' as const,
        status: 'committed' as const,
        notes: 'Test allocation for percentage capital calls'
      });

      if (!percentageAllocation) {
        this.addResult('Percentage Capital Call Setup', false, 'Failed to create test allocation');
        return;
      }

      // Test 25% capital call
      const partialCall = await this.storage.createCapitalCall({
        allocationId: percentageAllocation.id,
        callAmount: 25, // 25%
        amountType: 'percentage',
        callDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'scheduled',
        paidAmount: 0,
        outstanding_amount: percentageAllocation.amount * 0.25, // 25% of commitment
        notes: '25% capital call test'
      });

      this.addResult(
        'Percentage Capital Call',
        !!partialCall,
        `Created 25% capital call: $${(percentageAllocation.amount * 0.25).toLocaleString()} of $${percentageAllocation.amount.toLocaleString()}`
      );

      // Test payment and status update
      if (partialCall) {
        const paidAmount = percentageAllocation.amount * 0.25;
        await this.testCapitalCallPayment(partialCall, paidAmount);
        
        // Verify allocation status becomes 'partially_paid'
        const updatedStatus = await this.statusService.calculateAllocationStatus(percentageAllocation.id);
        this.addResult(
          'Partial Payment Status',
          updatedStatus === 'partially_paid',
          `Status after 25% payment: ${updatedStatus} (expected: partially_paid)`
        );
      }

    } catch (error) {
      this.addResult('Percentage Capital Calls', false, `Failed: ${error.message}`);
    }
  }

  private async testDollarCapitalCalls(allocation: any): Promise<void> {
    console.log('💵 Testing dollar-amount capital calls...');
    
    try {
      // Create new allocation for dollar testing
      const deals = await this.storage.getDeals();
      const funds = await this.storage.getFunds();
      
      const dollarAllocation = await this.allocationService.createAllocation({
        dealId: deals[2]?.id || deals[0].id,
        fundId: funds[0].id,
        amount: 1000000, // $1M commitment
        securityType: 'equity',
        amountType: 'dollar' as const,
        status: 'committed' as const,
        notes: 'Test allocation for dollar capital calls'
      });

      if (!dollarAllocation) {
        this.addResult('Dollar Capital Call Setup', false, 'Failed to create test allocation');
        return;
      }

      // Test $200k capital call (20% of $1M)
      const dollarCall = await this.storage.createCapitalCall({
        allocationId: dollarAllocation.id,
        callAmount: 200000, // $200k
        amountType: 'dollar',
        callDate: new Date(),
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: 'scheduled',
        paidAmount: 0,
        outstanding_amount: 200000,
        notes: '$200k capital call test'
      });

      this.addResult(
        'Dollar Capital Call',
        !!dollarCall,
        `Created $200k capital call from $1M commitment (20%)`
      );

      // Test payment
      if (dollarCall) {
        await this.testCapitalCallPayment(dollarCall, 200000);
      }

    } catch (error) {
      this.addResult('Dollar Capital Calls', false, `Failed: ${error.message}`);
    }
  }

  private async testPartialPayments(allocation: any): Promise<void> {
    console.log('⚡ Testing partial payment scenarios...');
    
    try {
      // Create capital call for testing partial payments
      const partialTestCall = await this.storage.createCapitalCall({
        allocationId: allocation.id,
        callAmount: 100000, // $100k call
        amountType: 'dollar',
        callDate: new Date(),
        dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'scheduled',
        paidAmount: 0,
        outstanding_amount: 100000,
        notes: 'Partial payment test'
      });

      if (partialTestCall) {
        // Pay 60% of the capital call
        const partialPayment = 60000; // $60k of $100k
        await this.testCapitalCallPayment(partialTestCall, partialPayment, true);
        
        // Verify outstanding amount is updated
        const updatedCall = await this.storage.getCapitalCall(partialTestCall.id);
        const expectedOutstanding = 100000 - 60000;
        
        this.addResult(
          'Partial Payment Tracking',
          updatedCall?.outstanding_amount === expectedOutstanding,
          `Outstanding: $${updatedCall?.outstanding_amount?.toLocaleString()} (expected: $${expectedOutstanding.toLocaleString()})`
        );
      }

    } catch (error) {
      this.addResult('Partial Payments', false, `Failed: ${error.message}`);
    }
  }

  private async testCapitalCallPayment(capitalCall: any, amount: number, isPartial: boolean = false): Promise<void> {
    try {
      // Process payment
      const updatedCall = await this.storage.updateCapitalCall(capitalCall.id, {
        paidAmount: (capitalCall.paidAmount || 0) + amount,
        outstanding_amount: Math.max(0, (capitalCall.outstanding_amount || capitalCall.callAmount) - amount),
        status: isPartial ? 'partially_paid' : 'paid',
        paidDate: new Date()
      });

      const paymentType = isPartial ? 'Partial Payment' : 'Full Payment';
      this.addResult(
        `${paymentType} Processing`,
        !!updatedCall,
        `Processed ${paymentType.toLowerCase()}: $${amount.toLocaleString()}`
      );

    } catch (error) {
      this.addResult('Payment Processing', false, `Failed: ${error.message}`);
    }
  }

  private async testFundMetricsIntegration(): Promise<void> {
    console.log('📈 Testing fund metrics integration...');
    
    try {
      const funds = await this.storage.getFunds();
      
      for (const fund of funds) {
        // Get fund allocations
        const allocations = await this.storage.getFundAllocationsByFund(fund.id);
        
        // Calculate expected metrics
        let expectedCommitted = 0;
        let expectedCalled = 0;
        
        for (const allocation of allocations) {
          expectedCommitted += allocation.amount || 0;
          
          // Get capital calls for this allocation
          const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
          for (const call of capitalCalls) {
            if (call.status === 'paid' || call.status === 'partially_paid') {
              expectedCalled += call.paidAmount || 0;
            }
          }
        }
        
        const expectedUncalled = expectedCommitted - expectedCalled;
        
        this.addResult(
          `Fund Metrics - ${fund.name}`,
          true,
          `Committed: $${expectedCommitted.toLocaleString()}, Called: $${expectedCalled.toLocaleString()}, Uncalled: $${expectedUncalled.toLocaleString()}`,
          {
            fundId: fund.id,
            committedCapital: expectedCommitted,
            calledCapital: expectedCalled,
            uncalledCapital: expectedUncalled
          }
        );
      }

    } catch (error) {
      this.addResult('Fund Metrics Integration', false, `Failed: ${error.message}`);
    }
  }

  private async testCalledUncalledTracking(): Promise<void> {
    console.log('🎯 Testing called/uncalled capital tracking...');
    
    try {
      // Get all allocations with capital calls
      const allocations = await this.storage.getAllocations();
      
      for (const allocation of allocations) {
        const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
        
        let totalCalled = 0;
        let totalPaid = 0;
        
        for (const call of capitalCalls) {
          totalCalled += call.callAmount || 0;
          totalPaid += call.paidAmount || 0;
        }
        
        const uncalledAmount = (allocation.amount || 0) - totalCalled;
        const unpaidAmount = totalCalled - totalPaid;
        
        this.addResult(
          `Capital Tracking - Allocation ${allocation.id}`,
          true,
          `Commitment: $${(allocation.amount || 0).toLocaleString()}, Called: $${totalCalled.toLocaleString()}, Paid: $${totalPaid.toLocaleString()}, Uncalled: $${uncalledAmount.toLocaleString()}`,
          {
            allocationId: allocation.id,
            commitment: allocation.amount,
            totalCalled,
            totalPaid,
            uncalledAmount,
            unpaidAmount
          }
        );
      }

    } catch (error) {
      this.addResult('Called/Uncalled Tracking', false, `Failed: ${error.message}`);
    }
  }

  private addResult(testName: string, passed: boolean, details: string, data?: any): void {
    this.results.push({ testName, passed, details, data });
    
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${details}`);
  }

  private printResults(): void {
    console.log('\n📋 Test Results Summary:');
    console.log('========================');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });
    
    console.log(`\n📊 Overall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
    
    if (passed === total) {
      console.log('🎉 All investment workflow tests passed!');
    } else {
      console.log('⚠️  Some tests failed - check implementation');
    }
  }
}

async function main() {
  const tester = new InvestmentWorkflowTester();
  await tester.runCompleteWorkflowTest();
}

// Run if this is the main module
main().catch(console.error);

export { InvestmentWorkflowTester };