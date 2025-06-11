import { StorageFactory } from "../storage-factory";
import { fundService } from "./fund.service";

/**
 * AllocationService - Centralized allocation management
 * Ensures modular and scalable allocation handling across the entire platform
 */
export class AllocationService {
  private storage = StorageFactory.getStorage();

  /**
   * Updates allocation status based on capital call payments
   * Modular function that maintains data integrity across the investment lifecycle
   */
  async updateAllocationStatus(allocationId: number): Promise<void> {
    try {
      const allocation = await this.storage.getFundAllocation(allocationId);
      if (!allocation) return;
      
      const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocationId);
      if (!capitalCalls || capitalCalls.length === 0) return;
      
      // Calculate payment totals
      let totalCalledAmount = 0;
      let totalPaidAmount = 0;
      
      for (const call of capitalCalls) {
        if (call.status !== 'scheduled') {
          totalCalledAmount += call.callAmount;
        }
        
        if (call.paidAmount && call.paidAmount > 0) {
          totalPaidAmount += call.paidAmount;
        }
      }
      
      // Determine new status using modular logic
      let newStatus = allocation.status;
      
      if (totalCalledAmount === 0) {
        newStatus = 'committed';
      } else if (totalPaidAmount >= totalCalledAmount) {
        newStatus = 'funded';
      } else if (totalPaidAmount > 0 && totalPaidAmount < totalCalledAmount) {
        newStatus = 'partially_paid';
      } else if (totalCalledAmount > 0 && totalPaidAmount === 0) {
        newStatus = 'committed';
      }
      
      // Update only if status changed
      if (newStatus !== allocation.status) {
        await this.storage.updateFundAllocation(allocationId, { status: newStatus });
        console.log(`Updated allocation ${allocationId} status from ${allocation.status} to ${newStatus}`);
        
        // Trigger portfolio weight recalculation for the fund
        await this.recalculatePortfolioWeights(allocation.fundId);
        
        // Update fund AUM
        await fundService.updateFundAUM(allocation.fundId);
      }
    } catch (error) {
      console.error(`Error updating allocation status for allocation ${allocationId}:`, error);
    }
  }

  /**
   * Recalculates portfolio weights based on commitments (not funding status)
   * This ensures scalable and authentic portfolio weight calculation
   */
  async recalculatePortfolioWeights(fundId: number): Promise<void> {
    try {
      const allocations = await this.storage.getAllocationsByFund(fundId);
      if (!allocations || allocations.length === 0) return;

      // Calculate total committed capital (all active allocations)
      const totalCommittedCapital = allocations
        .filter(a => a.status !== 'written_off')
        .reduce((sum, a) => sum + a.amount, 0);

      if (totalCommittedCapital <= 0) return;

      // Update portfolio weights based on commitment amounts
      for (const allocation of allocations) {
        const weight = allocation.status !== 'written_off' 
          ? (allocation.amount / totalCommittedCapital) * 100 
          : 0;
        
        await this.storage.updateFundAllocation(allocation.id, { portfolioWeight: weight });
      }
      
      console.log(`Recalculated portfolio weights for fund ${fundId} with total committed capital: $${totalCommittedCapital.toLocaleString()}`);
    } catch (error) {
      console.error(`Error recalculating portfolio weights for fund ${fundId}:`, error);
    }
  }

  /**
   * Creates a new allocation with proper integration
   * Ensures all downstream calculations are triggered
   */
  async createAllocation(allocationData: any): Promise<any> {
    try {
      // Create the allocation
      const allocation = await this.storage.createFundAllocation(allocationData);
      
      // Trigger portfolio weight recalculation
      await this.recalculatePortfolioWeights(allocation.fundId);
      
      // Update fund AUM
      await fundService.updateFundAUM(allocation.fundId);
      
      return allocation;
    } catch (error) {
      console.error('Error creating allocation:', error);
      throw error;
    }
  }

  /**
   * Updates an allocation with proper integration
   * Maintains data consistency across the investment lifecycle
   */
  async updateAllocation(allocationId: number, updates: any): Promise<any> {
    try {
      const allocation = await this.storage.updateFundAllocation(allocationId, updates);
      
      if (allocation) {
        // Trigger portfolio weight recalculation
        await this.recalculatePortfolioWeights(allocation.fundId);
        
        // Update fund AUM
        await fundService.updateFundAUM(allocation.fundId);
      }
      
      return allocation;
    } catch (error) {
      console.error('Error updating allocation:', error);
      throw error;
    }
  }
}

export const allocationService = new AllocationService();