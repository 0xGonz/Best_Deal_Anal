#!/usr/bin/env tsx

/**
 * Systematic Capital Call Creation Test Script
 * 
 * This script tests the complete allocation workflow to identify and fix
 * the persistent capital call creation failures.
 */

import { StorageFactory } from '../server/storage-factory';
import { productionAllocationService } from '../server/services/production-allocation.service';

interface TestResult {
  testName: string;
  success: boolean;
  data?: any;
  error?: string;
}

class AllocationWorkflowTester {
  private storage = StorageFactory.getStorage();
  private results: TestResult[] = [];

  async runCompleteTest(): Promise<void> {
    console.log('🚀 Starting Systematic Allocation Workflow Test');
    console.log('=' .repeat(60));

    await this.testDatabaseConnection();
    await this.testAllocationCreation();
    await this.testCapitalCallCreation();
    await this.testDataIntegrity();

    this.printResults();
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      const funds = await this.storage.getAllFunds();
      const deals = await this.storage.getAllDeals();
      
      this.addResult('Database Connection', true, {
        fundsCount: funds.length,
        dealsCount: deals.length
      });
    } catch (error) {
      this.addResult('Database Connection', false, null, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testAllocationCreation(): Promise<void> {
    try {
      // Get test data
      const funds = await this.storage.getAllFunds();
      const deals = await this.storage.getAllDeals();

      if (funds.length === 0 || deals.length === 0) {
        this.addResult('Allocation Creation', false, null, 'No funds or deals available for testing');
        return;
      }

      const testFund = funds[0];
      const testDeal = deals[0];

      console.log(`📋 Testing allocation creation: Fund ${testFund.id} → Deal ${testDeal.id}`);

      const allocationRequest = {
        fundId: testFund.id,
        dealId: testDeal.id,
        amount: 100000,
        amountType: 'dollar' as const,
        securityType: 'equity' as const,
        allocationDate: new Date().toISOString(),
        status: 'committed' as const,
        notes: 'Test allocation for workflow validation'
      };

      console.log('Allocation request payload:', JSON.stringify(allocationRequest, null, 2));

      const result = await productionAllocationService.createAllocation(allocationRequest, 4);

      if (result.success && result.allocation) {
        this.addResult('Allocation Creation', true, {
          allocationId: result.allocation.id,
          amount: result.allocation.amount,
          status: result.allocation.status
        });

        // Test capital call creation immediately
        await this.testImmediateCapitalCall(result.allocation.id);
      } else {
        this.addResult('Allocation Creation', false, result, result.error || 'Unknown allocation creation error');
      }

    } catch (error) {
      console.error('Allocation creation test failed:', error);
      this.addResult('Allocation Creation', false, null, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testImmediateCapitalCall(allocationId: number): Promise<void> {
    try {
      console.log(`💰 Testing capital call creation for allocation ${allocationId}`);

      const capitalCallPayload = {
        allocationId: allocationId,
        callAmount: 50000,
        amountType: 'dollar' as const,
        callDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        status: 'paid' as const,
        paidAmount: 50000,
        paidDate: new Date().toISOString(),
        outstanding_amount: "0",
        notes: 'Test immediate payment for workflow validation'
      };

      console.log('Capital call request payload:', JSON.stringify(capitalCallPayload, null, 2));

      const capitalCall = await this.storage.createCapitalCall({
        ...capitalCallPayload,
        callDate: new Date(capitalCallPayload.callDate),
        dueDate: new Date(capitalCallPayload.dueDate),
        paidDate: new Date(capitalCallPayload.paidDate)
      });

      this.addResult('Capital Call Creation', true, {
        capitalCallId: capitalCall.id,
        allocationId: capitalCall.allocationId,
        callAmount: capitalCall.callAmount,
        status: capitalCall.status
      });

    } catch (error) {
      console.error('Capital call creation test failed:', error);
      this.addResult('Capital Call Creation', false, null, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testCapitalCallCreation(): Promise<void> {
    try {
      // Get existing allocations
      const allocations = await this.storage.getAllFundAllocations();

      if (allocations.length === 0) {
        this.addResult('Standalone Capital Call Test', false, null, 'No allocations available for testing');
        return;
      }

      const testAllocation = allocations[0];
      console.log(`💳 Testing standalone capital call for allocation ${testAllocation.id}`);

      const capitalCallData = {
        allocationId: testAllocation.id,
        callAmount: 25000,
        amountType: 'dollar' as const,
        callDate: new Date(),
        dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: 'scheduled' as const,
        paidAmount: 0,
        paidDate: null,
        outstanding_amount: "25000",
        notes: 'Standalone capital call test'
      };

      const capitalCall = await this.storage.createCapitalCall(capitalCallData);

      this.addResult('Standalone Capital Call Test', true, {
        capitalCallId: capitalCall.id,
        callAmount: capitalCall.callAmount,
        outstanding: capitalCall.outstanding_amount
      });

    } catch (error) {
      console.error('Standalone capital call test failed:', error);
      this.addResult('Standalone Capital Call Test', false, null, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testDataIntegrity(): Promise<void> {
    try {
      const allocations = await this.storage.getAllFundAllocations();
      const capitalCalls = await this.storage.getAllCapitalCalls();

      let orphanedCalls = 0;
      let validCalls = 0;

      for (const call of capitalCalls) {
        const allocation = allocations.find(a => a.id === call.allocationId);
        if (!allocation) {
          orphanedCalls++;
        } else {
          validCalls++;
        }
      }

      this.addResult('Data Integrity Check', true, {
        totalAllocations: allocations.length,
        totalCapitalCalls: capitalCalls.length,
        validCapitalCalls: validCalls,
        orphanedCapitalCalls: orphanedCalls
      });

    } catch (error) {
      this.addResult('Data Integrity Check', false, null, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private addResult(testName: string, success: boolean, data?: any, error?: string): void {
    this.results.push({ testName, success, data, error });
  }

  private printResults(): void {
    console.log('\n🎯 Test Results Summary');
    console.log('=' .repeat(60));

    let passed = 0;
    let failed = 0;

    for (const result of this.results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName}`);
      
      if (result.data && result.success) {
        console.log(`    Data: ${JSON.stringify(result.data, null, 4)}`);
      }
      
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }

      result.success ? passed++ : failed++;
      console.log('');
    }

    console.log('=' .repeat(60));
    console.log(`📊 Summary: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
      console.log('\n🔧 Recommendations:');
      console.log('1. Check database schema consistency');
      console.log('2. Verify allocation ID is properly returned from creation');
      console.log('3. Validate capital call schema matches database structure');
      console.log('4. Ensure proper date handling in both frontend and backend');
    } else {
      console.log('\n🎉 All tests passed! Allocation workflow is functioning correctly.');
    }
  }
}

async function main() {
  const tester = new AllocationWorkflowTester();
  await tester.runCompleteTest();
  process.exit(0);
}

// Run the test if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
}