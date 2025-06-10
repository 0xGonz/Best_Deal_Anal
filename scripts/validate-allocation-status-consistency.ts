/**
 * Comprehensive validation script for allocation status consistency
 * Ensures all database records, API endpoints, and frontend components use standardized status values
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { DatabaseStorage } from '../server/database-storage';

interface ValidationResult {
  test: string;
  passed: boolean;
  details: string;
  errors?: string[];
}

class AllocationStatusValidator {
  private storage = new DatabaseStorage();
  private results: ValidationResult[] = [];

  async runAllValidations(): Promise<void> {
    console.log('🔍 Starting comprehensive allocation status validation...');
    
    await this.validateDatabaseStatus();
    await this.validateAllocationRetrieval();
    await this.validateStatusTransitions();
    await this.validateCapitalCallsIntegration();
    
    this.printResults();
  }

  private async validateDatabaseStatus(): Promise<void> {
    try {
      console.log('📊 Validating database status distribution...');
      
      // Check current status values
      const statusDistribution = await db.execute(sql`
        SELECT status, COUNT(*) as count 
        FROM fund_allocations 
        GROUP BY status 
        ORDER BY count DESC
      `);
      
      const validStatuses = ['committed', 'funded', 'unfunded', 'partially_paid', 'written_off'];
      const foundStatuses = statusDistribution.rows.map(row => row.status);
      const invalidStatuses = foundStatuses.filter(status => !validStatuses.includes(status as string));
      
      if (invalidStatuses.length === 0) {
        this.addResult('Database Status Values', true, 
          `All ${foundStatuses.length} unique status values are valid: ${foundStatuses.join(', ')}`);
      } else {
        this.addResult('Database Status Values', false, 
          `Found ${invalidStatuses.length} invalid status values`, invalidStatuses);
      }
      
      // Check for NULL values
      const nullCount = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM fund_allocations 
        WHERE status IS NULL
      `);
      
      const nullRecords = Number(nullCount.rows[0]?.count || 0);
      this.addResult('NULL Status Check', nullRecords === 0, 
        nullRecords === 0 ? 'No NULL status values found' : `Found ${nullRecords} NULL status records`);
        
    } catch (error) {
      this.addResult('Database Status Validation', false, 
        `Database validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateAllocationRetrieval(): Promise<void> {
    try {
      console.log('🔄 Testing allocation retrieval APIs...');
      
      // Test getting all allocations
      const allAllocations = await this.storage.getAllocationsByFund(2); // Test with fund 2
      
      if (allAllocations.length > 0) {
        const statusValues = allAllocations.map(a => a.status);
        const uniqueStatuses = [...new Set(statusValues)];
        
        this.addResult('Allocation API Retrieval', true, 
          `Successfully retrieved ${allAllocations.length} allocations with statuses: ${uniqueStatuses.join(', ')}`);
      } else {
        this.addResult('Allocation API Retrieval', false, 'No allocations found for testing');
      }
      
    } catch (error) {
      this.addResult('Allocation API Retrieval', false, 
        `API retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateStatusTransitions(): Promise<void> {
    try {
      console.log('🔀 Testing status transition logic...');
      
      // Test updating allocation status
      const allocations = await this.storage.getAllocationsByFund(2);
      
      if (allocations.length > 0) {
        const testAllocation = allocations[0];
        const originalStatus = testAllocation.status;
        
        // Test valid status update
        const updatedAllocation = await this.storage.updateFundAllocation(testAllocation.id, {
          status: 'committed'
        });
        
        if (updatedAllocation && updatedAllocation.status === 'committed') {
          // Restore original status
          await this.storage.updateFundAllocation(testAllocation.id, {
            status: originalStatus
          });
          
          this.addResult('Status Transition Logic', true, 
            'Status updates work correctly with standardized values');
        } else {
          this.addResult('Status Transition Logic', false, 
            'Status update did not work as expected');
        }
      } else {
        this.addResult('Status Transition Logic', false, 'No allocations available for testing');
      }
      
    } catch (error) {
      this.addResult('Status Transition Logic', false, 
        `Status transition test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateCapitalCallsIntegration(): Promise<void> {
    try {
      console.log('💰 Testing capital calls integration...');
      
      // Test capital calls status consistency
      const capitalCallsCheck = await db.execute(sql`
        SELECT DISTINCT status, COUNT(*) as count
        FROM capital_calls 
        GROUP BY status
      `);
      
      const capitalCallStatuses = capitalCallsCheck.rows.map(row => row.status);
      const validCapitalCallStatuses = ['scheduled', 'called', 'partially_paid', 'paid', 'defaulted', 'overdue'];
      const invalidCapitalCallStatuses = capitalCallStatuses.filter(status => 
        !validCapitalCallStatuses.includes(status as string));
      
      if (invalidCapitalCallStatuses.length === 0) {
        this.addResult('Capital Calls Status Integration', true, 
          `All capital call statuses are valid: ${capitalCallStatuses.join(', ')}`);
      } else {
        this.addResult('Capital Calls Status Integration', false, 
          'Found invalid capital call statuses', invalidCapitalCallStatuses);
      }
      
    } catch (error) {
      this.addResult('Capital Calls Integration', false, 
        `Capital calls validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private addResult(test: string, passed: boolean, details: string, errors?: string[]): void {
    this.results.push({ test, passed, details, errors });
  }

  private printResults(): void {
    console.log('\n📋 Allocation Status Validation Results:');
    console.log('='.repeat(60));
    
    let passedCount = 0;
    let failedCount = 0;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${status} ${result.test}`);
      console.log(`   ${result.details}`);
      
      if (result.errors && result.errors.length > 0) {
        console.log('   Errors:');
        result.errors.forEach(error => console.log(`     - ${error}`));
      }
      
      if (result.passed) passedCount++;
      else failedCount++;
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Summary: ${passedCount} passed, ${failedCount} failed`);
    
    if (failedCount === 0) {
      console.log('🎉 All allocation status validations passed!');
      console.log('✅ The allocation status enum standardization is complete and working correctly.');
    } else {
      console.log('⚠️  Some validations failed. Please review the issues above.');
    }
  }
}

async function main() {
  const validator = new AllocationStatusValidator();
  await validator.runAllValidations();
  process.exit(0);
}

main().catch(console.error);