/**
 * Allocation Sync Service
 * 
 * Ensures real-time synchronization between capital calls and allocations
 * Addresses the data drift identified in the post-mortem analysis
 */

import { StorageFactory } from '../storage-factory';
import { AllocationStatusService } from './allocation-status.service';

export interface SyncResult {
  allocationId: number;
  previousPaidAmount: number;
  newPaidAmount: number;
  previousStatus: string;
  newStatus: string;
  synced: boolean;
  error?: string;
}

export class AllocationSyncService {
  private static storage = StorageFactory.getStorage();

  /**
   * Syncs a single allocation's paid amount and status with its capital calls
   */
  static async syncAllocation(allocationId: number): Promise<SyncResult> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) {
        return {
          allocationId,
          previousPaidAmount: 0,
          newPaidAmount: 0,
          previousStatus: 'unknown',
          newStatus: 'unknown',
          synced: false,
          error: 'Allocation not found'
        };
      }

      // Get all capital calls for this allocation
      const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocationId);
      
      // Calculate total paid amount from capital calls
      let totalPaidFromCalls = 0;
      for (const call of capitalCalls) {
        totalPaidFromCalls += Number(call.paidAmount) || 0;
      }

      const previousPaidAmount = Number(allocation.paidAmount) || 0;
      const previousStatus = allocation.status;

      // Calculate new status based on actual payments
      const statusResult = AllocationStatusService.calculateStatus({
        amount: Number(allocation.amount),
        paidAmount: totalPaidFromCalls
      });

      const newStatus = statusResult.status;

      // Update allocation if there's a discrepancy
      const needsSync = previousPaidAmount !== totalPaidFromCalls || previousStatus !== newStatus;
      
      if (needsSync) {
        await this.storage.updateFundAllocation(allocationId, {
          paidAmount: totalPaidFromCalls,
          status: newStatus
        });
      }

      return {
        allocationId,
        previousPaidAmount,
        newPaidAmount: totalPaidFromCalls,
        previousStatus,
        newStatus,
        synced: needsSync
      };

    } catch (error) {
      console.error(`Error syncing allocation ${allocationId}:`, error);
      return {
        allocationId,
        previousPaidAmount: 0,
        newPaidAmount: 0,
        previousStatus: 'unknown',
        newStatus: 'unknown',
        synced: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Syncs all allocations for a fund
   */
  static async syncFundAllocations(fundId: number): Promise<SyncResult[]> {
    try {
      const allocations = await this.storage.getAllocationsByFund(fundId);
      const results: SyncResult[] = [];

      for (const allocation of allocations) {
        const result = await this.syncAllocation(allocation.id);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error(`Error syncing fund ${fundId} allocations:`, error);
      return [];
    }
  }

  /**
   * Syncs all allocations in the system
   */
  static async syncAllAllocations(): Promise<{
    totalAllocations: number;
    syncedAllocations: number;
    errors: number;
    results: SyncResult[];
  }> {
    try {
      const allAllocations = await this.storage.getAllocations();
      const results: SyncResult[] = [];

      for (const allocation of allAllocations) {
        const result = await this.syncAllocation(allocation.id);
        results.push(result);
      }

      const syncedCount = results.filter(r => r.synced).length;
      const errorCount = results.filter(r => r.error).length;

      return {
        totalAllocations: allAllocations.length,
        syncedAllocations: syncedCount,
        errors: errorCount,
        results
      };
    } catch (error) {
      console.error('Error syncing all allocations:', error);
      return {
        totalAllocations: 0,
        syncedAllocations: 0,
        errors: 1,
        results: []
      };
    }
  }

  /**
   * Real-time sync after capital call payment
   */
  static async syncAfterPayment(capitalCallId: number): Promise<SyncResult | null> {
    try {
      const capitalCall = await this.storage.getCapitalCall(capitalCallId);
      if (!capitalCall) {
        console.error(`Capital call ${capitalCallId} not found for sync`);
        return null;
      }

      return await this.syncAllocation(capitalCall.allocationId);
    } catch (error) {
      console.error(`Error syncing after payment for capital call ${capitalCallId}:`, error);
      return null;
    }
  }

  /**
   * Validates allocation data integrity
   */
  static async validateAllocationIntegrity(allocationId: number): Promise<{
    isValid: boolean;
    issues: string[];
    allocation?: any;
    capitalCalls?: any[];
  }> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) {
        return {
          isValid: false,
          issues: ['Allocation not found']
        };
      }

      const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocationId);
      const issues: string[] = [];

      // Check for data consistency
      const totalPaidFromCalls = capitalCalls.reduce((sum, call) => sum + (Number(call.paidAmount) || 0), 0);
      const allocationPaidAmount = Number(allocation.paidAmount) || 0;

      if (Math.abs(totalPaidFromCalls - allocationPaidAmount) > 0.01) {
        issues.push(`Paid amount mismatch: allocation shows $${allocationPaidAmount}, capital calls total $${totalPaidFromCalls}`);
      }

      // Check status consistency
      const expectedStatus = AllocationStatusService.calculateStatus({
        amount: Number(allocation.amount),
        paidAmount: totalPaidFromCalls
      }).status;

      if (allocation.status !== expectedStatus) {
        issues.push(`Status mismatch: allocation shows '${allocation.status}', should be '${expectedStatus}'`);
      }

      // Check for orphaned capital calls
      const orphanedCalls = capitalCalls.filter(call => !call.allocationId);
      if (orphanedCalls.length > 0) {
        issues.push(`${orphanedCalls.length} orphaned capital calls found`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        allocation,
        capitalCalls
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Automatic sync trigger after any capital call modification
   */
  static async triggerAutoSync(allocationId: number): Promise<void> {
    try {
      // Run sync in background to avoid blocking the main request
      setImmediate(async () => {
        const result = await this.syncAllocation(allocationId);
        if (result.synced) {
          console.log(`Auto-synced allocation ${allocationId}: status ${result.previousStatus} → ${result.newStatus}, paid $${result.previousPaidAmount} → $${result.newPaidAmount}`);
        }
      });
    } catch (error) {
      console.error(`Auto-sync error for allocation ${allocationId}:`, error);
    }
  }
}

export default AllocationSyncService;