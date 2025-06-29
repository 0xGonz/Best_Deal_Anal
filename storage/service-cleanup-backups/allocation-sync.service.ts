/**
 * Allocation Sync Service
 * 
 * Maintains data consistency across all components when fund allocations change.
 * Ensures modular integration between allocations, capital calls, and calendar events.
 */

import { StorageFactory } from '../storage-factory';

export interface AllocationSyncResult {
  success: boolean;
  allocationId: number;
  updatedCapitalCalls: number[];
  updatedClosingEvents: number[];
  updatedTimelineEvents: number[];
  errors: string[];
}

export class AllocationSyncService {
  private static storage = StorageFactory.getStorage();

  /**
   * Sync all related components when an allocation amount changes
   */
  static async syncAllocationUpdate(
    allocationId: number,
    oldAmount: number,
    newAmount: number,
    userId: number
  ): Promise<AllocationSyncResult> {
    const result: AllocationSyncResult = {
      success: false,
      allocationId,
      updatedCapitalCalls: [],
      updatedClosingEvents: [],
      updatedTimelineEvents: [],
      errors: []
    };

    try {
      // Get the allocation details
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) {
        result.errors.push('Allocation not found');
        return result;
      }

      // 1. Update related capital calls
      await this.syncCapitalCalls(allocation.id, oldAmount, newAmount, result);

      // 2. Update related closing schedule events
      await this.syncClosingEvents(allocation.dealId, oldAmount, newAmount, result);

      // 3. Create timeline event for the sync
      await this.createSyncTimelineEvent(allocation.dealId, allocationId, oldAmount, newAmount, userId, result);

      result.success = result.errors.length === 0;
      
      console.log(`🔄 Allocation sync completed for ${allocationId}: ${result.errors.length === 0 ? 'SUCCESS' : 'WITH ERRORS'}`);
      
      return result;

    } catch (error) {
      console.error('Allocation sync error:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
      return result;
    }
  }

  /**
   * Update capital calls to match new allocation amount
   */
  private static async syncCapitalCalls(
    allocationId: number,
    oldAmount: number,
    newAmount: number,
    result: AllocationSyncResult
  ): Promise<void> {
    try {
      const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocationId);
      
      for (const call of capitalCalls) {
        // Calculate proportional adjustment
        const ratio = newAmount / oldAmount;
        const newCallAmount = Math.round(call.callAmount * ratio);
        
        // Update the capital call
        const updatedCall = await this.storage.updateCapitalCall(call.id, {
          callAmount: newCallAmount
        });
        
        if (updatedCall) {
          result.updatedCapitalCalls.push(call.id);
          console.log(`📞 Updated capital call ${call.id}: $${call.callAmount.toLocaleString()} → $${newCallAmount.toLocaleString()}`);
        } else {
          result.errors.push(`Failed to update capital call ${call.id}`);
        }
      }
      
    } catch (error) {
      console.error('Capital call sync error:', error);
      result.errors.push('Failed to sync capital calls');
    }
  }

  /**
   * Update closing schedule events to reflect allocation changes
   */
  private static async syncClosingEvents(
    dealId: number,
    oldAmount: number,
    newAmount: number,
    result: AllocationSyncResult
  ): Promise<void> {
    try {
      const closingEvents = await this.storage.getClosingScheduleEventsByDeal(dealId);
      
      for (const event of closingEvents) {
        // Only update dollar-amount events
        if (event.amountType === 'dollar' && event.targetAmount) {
          const ratio = newAmount / oldAmount;
          const newTargetAmount = Math.round(event.targetAmount * ratio);
          
          // Update the closing event
          const updatedEvent = await this.storage.updateClosingScheduleEventStatus(
            event.id,
            event.status,
            event.actualDate,
            newTargetAmount
          );
          
          if (updatedEvent) {
            result.updatedClosingEvents.push(event.id);
            console.log(`📅 Updated closing event ${event.id}: $${event.targetAmount.toLocaleString()} → $${newTargetAmount.toLocaleString()}`);
          } else {
            result.errors.push(`Failed to update closing event ${event.id}`);
          }
        }
      }
      
    } catch (error) {
      console.error('Closing events sync error:', error);
      result.errors.push('Failed to sync closing events');
    }
  }

  /**
   * Create timeline event documenting the sync
   */
  private static async createSyncTimelineEvent(
    dealId: number,
    allocationId: number,
    oldAmount: number,
    newAmount: number,
    userId: number,
    result: AllocationSyncResult
  ): Promise<void> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      const fund = allocation ? await this.storage.getFund(allocation.fundId) : null;
      
      const content = `Fund allocation updated from $${oldAmount.toLocaleString()} to $${newAmount.toLocaleString()} for ${fund?.name || 'fund'}. Synced ${result.updatedCapitalCalls.length} capital calls and ${result.updatedClosingEvents.length} calendar events.`;
      
      const timelineEvent = await this.storage.createTimelineEvent({
        dealId,
        eventType: 'capital_call_update',
        content,
        createdBy: userId,
        metadata: {
          allocationId: allocationId,
          oldAmount: oldAmount,
          newAmount: newAmount,
          fundId: allocation?.fundId || 0,
          fundName: fund?.name || 'Unknown Fund',
          syncedCapitalCalls: result.updatedCapitalCalls.length,
          syncedClosingEvents: result.updatedClosingEvents.length
        }
      });
      
      if (timelineEvent) {
        result.updatedTimelineEvents.push(timelineEvent.id);
        console.log(`✅ Sync timeline event created for deal ${dealId}`);
      }
      
    } catch (error) {
      console.error('Timeline sync event error:', error);
      result.errors.push('Failed to create sync timeline event');
    }
  }

  /**
   * Perform full system sync for all allocations
   */
  static async performFullSync(userId: number): Promise<{
    processedAllocations: number;
    totalUpdates: number;
    errors: string[];
  }> {
    const report = {
      processedAllocations: 0,
      totalUpdates: 0,
      errors: []
    };

    try {
      // This would be used for a full system reconciliation
      // Implementation would depend on specific requirements
      console.log('🔄 Full allocation sync initiated by user:', userId);
      
    } catch (error) {
      console.error('Full sync error:', error);
      report.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return report;
  }
}