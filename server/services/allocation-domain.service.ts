/**
 * Unified Allocation Domain Service
 * 
 * Consolidates all allocation-related business logic into a single domain service.
 * This replaces 17 separate allocation services with a unified approach.
 * 
 * Created during Phase 2 systematic refactoring
 */

import { StorageFactory } from '../storage-factory';
import { FundAllocation, InsertFundAllocation, CapitalCall, InsertCapitalCall } from '@shared/schema';

export class AllocationDomainService {
  private storage = StorageFactory.create();

  // ==================== ALLOCATION CORE OPERATIONS ====================
  
  /**
   * Creates a new fund allocation with validation and integrity checks
   */
  async createAllocation(allocationData: InsertFundAllocation): Promise<FundAllocation> {
    // Validate allocation data
    if (allocationData.amount <= 0) {
      throw new Error('Allocation amount must be positive');
    }

    // Check for duplicate allocations
    const existingAllocations = await this.storage.getFundAllocations();
    const duplicate = existingAllocations.find(a => 
      a.dealId === allocationData.dealId && a.fundId === allocationData.fundId
    );
    
    if (duplicate) {
      throw new Error('Allocation already exists for this deal-fund combination');
    }

    // Create allocation
    const allocation = await this.storage.createFundAllocation(allocationData);
    
    // Log allocation creation
    await this.logAllocationEvent(allocation.id, 'created', 'Allocation created successfully');
    
    return allocation;
  }

  /**
   * Updates allocation status with business logic validation
   */
  async updateAllocationStatus(allocationId: number, newStatus: string): Promise<FundAllocation> {
    const allocation = await this.storage.getFundAllocation(allocationId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Validate status transition
    if (!this.isValidStatusTransition(allocation.status, newStatus)) {
      throw new Error(`Invalid status transition from ${allocation.status} to ${newStatus}`);
    }

    // Update status
    const updatedAllocation = await this.storage.updateFundAllocation(allocationId, {
      status: newStatus as any
    });

    if (!updatedAllocation) {
      throw new Error('Failed to update allocation status');
    }

    await this.logAllocationEvent(allocationId, 'status_changed', 
      `Status changed from ${allocation.status} to ${newStatus}`);

    return updatedAllocation;
  }

  // ==================== CAPITAL CALL OPERATIONS ====================

  /**
   * Creates capital call with allocation validation
   */
  async createCapitalCall(capitalCallData: InsertCapitalCall): Promise<CapitalCall> {
    const allocation = await this.storage.getFundAllocation(capitalCallData.allocationId);
    if (!allocation) {
      throw new Error('Associated allocation not found');
    }

    // Validate capital call amount
    if (capitalCallData.callAmount <= 0) {
      throw new Error('Capital call amount must be positive');
    }

    // Create capital call
    const capitalCall = await this.storage.createCapitalCall(capitalCallData);
    
    // Update allocation status if this is the first capital call
    const existingCalls = await this.getCapitalCallsForAllocation(allocation.id);
    if (existingCalls.length === 1) { // First call
      await this.updateAllocationStatus(allocation.id, 'partially_paid');
    }

    await this.logAllocationEvent(allocation.id, 'capital_call', 
      `Capital call created for amount: ${capitalCallData.callAmount}`);

    return capitalCall;
  }

  /**
   * Processes capital call payment and updates allocation status
   */
  async processCapitalCallPayment(capitalCallId: number, paymentAmount: number): Promise<void> {
    const capitalCall = await this.storage.getCapitalCall(capitalCallId);
    if (!capitalCall) {
      throw new Error('Capital call not found');
    }

    const allocation = await this.storage.getFundAllocation(capitalCall.allocationId);
    if (!allocation) {
      throw new Error('Associated allocation not found');
    }

    // Update paid amount
    const newPaidAmount = (capitalCall.paidAmount || 0) + paymentAmount;
    await this.storage.updateCapitalCall(capitalCallId, {
      paidAmount: newPaidAmount,
      paidDate: new Date()
    });

    // Check if allocation is fully funded
    const totalCalled = await this.getTotalCalledAmount(allocation.id);
    const totalPaid = await this.getTotalPaidAmount(allocation.id);
    
    let newStatus = allocation.status;
    if (totalPaid >= allocation.amount) {
      newStatus = 'funded';
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid';
    }

    if (newStatus !== allocation.status) {
      await this.updateAllocationStatus(allocation.id, newStatus);
    }

    await this.logAllocationEvent(allocation.id, 'payment', 
      `Payment processed: ${paymentAmount}`);
  }

  // ==================== BUSINESS LOGIC HELPERS ====================

  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'committed': ['partially_paid', 'funded', 'unfunded'],
      'partially_paid': ['funded', 'unfunded'],
      'funded': ['written_off'],
      'unfunded': ['committed', 'written_off'],
      'written_off': []
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  private async getTotalCalledAmount(allocationId: number): Promise<number> {
    const capitalCalls = await this.getCapitalCallsForAllocation(allocationId);
    return capitalCalls.reduce((total, call) => total + call.callAmount, 0);
  }

  private async getTotalPaidAmount(allocationId: number): Promise<number> {
    const capitalCalls = await this.getCapitalCallsForAllocation(allocationId);
    return capitalCalls.reduce((total, call) => total + (call.paidAmount || 0), 0);
  }

  private async getCapitalCallsForAllocation(allocationId: number): Promise<CapitalCall[]> {
    const allCalls = await this.storage.getCapitalCalls();
    return allCalls.filter(call => call.allocationId === allocationId);
  }

  private async logAllocationEvent(allocationId: number, eventType: string, message: string): Promise<void> {
    // Implementation would log to timeline events or audit log
    console.log(`Allocation ${allocationId}: ${eventType} - ${message}`);
  }

  // ==================== METRICS AND ANALYTICS ====================

  /**
   * Calculates allocation metrics for reporting
   */
  async calculateAllocationMetrics(fundId?: number): Promise<{
    totalAllocations: number;
    totalCommitted: number;
    totalCalled: number;
    totalPaid: number;
    averageAllocationSize: number;
  }> {
    const allocations = await this.storage.getFundAllocations();
    const filteredAllocations = fundId 
      ? allocations.filter(a => a.fundId === fundId)
      : allocations;

    const totalCommitted = filteredAllocations.reduce((sum, a) => sum + a.amount, 0);
    
    let totalCalled = 0;
    let totalPaid = 0;
    
    for (const allocation of filteredAllocations) {
      totalCalled += await this.getTotalCalledAmount(allocation.id);
      totalPaid += await this.getTotalPaidAmount(allocation.id);
    }

    return {
      totalAllocations: filteredAllocations.length,
      totalCommitted,
      totalCalled,
      totalPaid,
      averageAllocationSize: filteredAllocations.length > 0 
        ? totalCommitted / filteredAllocations.length 
        : 0
    };
  }
}