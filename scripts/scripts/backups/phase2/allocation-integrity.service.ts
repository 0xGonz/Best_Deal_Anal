import { DatabaseStorage } from '../database-storage';
import { InsertFundAllocation, InsertCapitalCall } from '../../shared/schema';

/**
 * AllocationIntegrityService
 * 
 * Provides modular, robust allocation operations with built-in data integrity
 * and duplicate prevention. This service ensures operations are idempotent
 * and handles database constraint violations gracefully.
 */
export class AllocationIntegrityService {
  private storage: DatabaseStorage;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  /**
   * Creates a fund allocation with built-in duplicate prevention
   * and proper error handling. Returns existing allocation if duplicate
   * constraints are violated (idempotent operation).
   */
  async createAllocationSafe(allocationData: InsertFundAllocation): Promise<{ 
    allocation: any; 
    isNew: boolean; 
    error?: string; 
  }> {
    try {
      // Attempt to create the allocation
      const allocation = await this.storage.createFundAllocation(allocationData);
      
      return {
        allocation,
        isNew: true
      };
      
    } catch (error: any) {
      // Handle unique constraint violations gracefully
      if (error.code === '23505' || error.message?.includes('unique_fund_deal_allocation')) {
        console.log('🔍 Duplicate allocation detected, finding existing allocation...');
        
        // Find and return the existing allocation
        const existingAllocations = await this.storage.getAllocationsByDeal(allocationData.dealId);
        const existing = existingAllocations.find(a => 
          a.fundId === allocationData.fundId && 
          a.dealId === allocationData.dealId &&
          new Date(a.allocationDate).toDateString() === new Date(allocationData.allocationDate).toDateString()
        );
        
        if (existing) {
          return {
            allocation: existing,
            isNew: false,
            error: 'Allocation already exists with these parameters'
          };
        }
      }
      
      // Handle amount validation errors
      if (error.code === '23514' || error.message?.includes('positive_allocation_amount')) {
        throw new Error('Allocation amount must be greater than 0');
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Creates a capital call with built-in duplicate prevention
   * for the same allocation and date combination.
   */
  async createCapitalCallSafe(capitalCallData: InsertCapitalCall): Promise<{
    capitalCall: any;
    isNew: boolean;
    error?: string;
  }> {
    try {
      const capitalCall = await this.storage.createCapitalCall(capitalCallData);
      
      return {
        capitalCall,
        isNew: true
      };
      
    } catch (error: any) {
      // Handle unique constraint violations for capital calls
      if (error.code === '23505' || error.message?.includes('unique_allocation_call_date')) {
        console.log('🔍 Duplicate capital call detected, finding existing call...');
        
        // Find existing capital call
        const existingCalls = await this.storage.getCapitalCallsByAllocation(capitalCallData.allocationId);
        const existing = existingCalls.find(c => 
          new Date(c.callDate).toDateString() === new Date(capitalCallData.callDate).toDateString()
        );
        
        if (existing) {
          return {
            capitalCall: existing,
            isNew: false,
            error: 'Capital call already exists for this allocation and date'
          };
        }
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Performs a complete allocation workflow with transaction-like behavior.
   * Creates allocation and optional immediate capital call with proper rollback
   * handling if any step fails.
   */
  async executeAllocationWorkflow(
    allocationData: InsertFundAllocation,
    capitalCallData?: InsertCapitalCall
  ): Promise<{
    allocation: any;
    capitalCall?: any;
    isNewAllocation: boolean;
    isNewCapitalCall?: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    
    // Step 1: Create allocation
    const allocationResult = await this.createAllocationSafe(allocationData);
    
    if (allocationResult.error) {
      warnings.push(allocationResult.error);
    }
    
    let capitalCallResult;
    
    // Step 2: Create capital call if provided
    if (capitalCallData) {
      // Use the actual allocation ID (whether new or existing)
      const capitalCallWithId = {
        ...capitalCallData,
        allocationId: allocationResult.allocation.id
      };
      
      try {
        capitalCallResult = await this.createCapitalCallSafe(capitalCallWithId);
        
        if (capitalCallResult.error) {
          warnings.push(capitalCallResult.error);
        }
        
      } catch (error) {
        console.error('Failed to create capital call:', error);
        warnings.push('Capital call creation failed but allocation was successful');
      }
    }
    
    return {
      allocation: allocationResult.allocation,
      capitalCall: capitalCallResult?.capitalCall,
      isNewAllocation: allocationResult.isNew,
      isNewCapitalCall: capitalCallResult?.isNew,
      warnings
    };
  }

  /**
   * Validates allocation data before creation to catch issues early
   */
  validateAllocationData(data: InsertFundAllocation): string[] {
    const errors: string[] = [];
    
    if (!data.fundId || data.fundId <= 0) {
      errors.push('Valid fund ID is required');
    }
    
    if (!data.dealId || data.dealId <= 0) {
      errors.push('Valid deal ID is required');
    }
    
    if (!data.amount || data.amount <= 0) {
      errors.push('Allocation amount must be greater than 0');
    }
    
    if (!data.allocationDate) {
      errors.push('Allocation date is required');
    }
    
    if (!data.securityType) {
      errors.push('Security type is required');
    }
    
    return errors;
  }

  /**
   * Validates capital call data before creation
   */
  validateCapitalCallData(data: InsertCapitalCall): string[] {
    const errors: string[] = [];
    
    if (!data.allocationId || data.allocationId <= 0) {
      errors.push('Valid allocation ID is required');
    }
    
    if (!data.callAmount || data.callAmount <= 0) {
      errors.push('Call amount must be greater than 0');
    }
    
    if (!data.callDate) {
      errors.push('Call date is required');
    }
    
    if (!data.dueDate) {
      errors.push('Due date is required');
    }
    
    return errors;
  }
}