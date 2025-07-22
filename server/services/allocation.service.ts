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
   * Modular design supports different allocation sizes and fund configurations
   */
  async recalculatePortfolioWeights(fundId: number): Promise<void> {
    try {
      const allocations = await this.storage.getAllocationsByFund(fundId);
      if (!allocations || allocations.length === 0) {
        console.log(`No allocations found for fund ${fundId}, skipping weight calculation`);
        return;
      }

      // Calculate total committed capital (all active allocations)
      const activeAllocations = allocations.filter(a => a.status !== 'written_off');
      const totalCommittedCapital = activeAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);

      if (totalCommittedCapital <= 0) {
        console.log(`Fund ${fundId} has no committed capital, setting all weights to 0`);
        // Set all weights to 0 if no committed capital
        for (const allocation of allocations) {
          await this.storage.updateFundAllocation(allocation.id, { portfolioWeight: 0 });
        }
        return;
      }

      // Calculate and update portfolio weights with precision
      const updatedWeights: Array<{id: number, amount: number, weight: number}> = [];
      
      for (const allocation of allocations) {
        let weight = 0;
        
        if (allocation.status !== 'written_off' && allocation.amount > 0) {
          // Calculate weight as percentage with 2 decimal precision
          weight = Math.round((allocation.amount / totalCommittedCapital) * 10000) / 100;
        }
        
        await this.storage.updateFundAllocation(allocation.id, { portfolioWeight: weight });
        updatedWeights.push({
          id: allocation.id,
          amount: allocation.amount,
          weight: weight
        });
      }
      
      // Detailed logging for modular debugging
      console.log(`Portfolio weights recalculated for fund ${fundId}:`);
      console.log(`  Total committed capital: $${totalCommittedCapital.toLocaleString()}`);
      console.log(`  Active allocations: ${activeAllocations.length}`);
      updatedWeights.forEach(({id, amount, weight}) => {
        console.log(`    Allocation ${id}: $${amount.toLocaleString()} = ${weight}%`);
      });
      
      // Verify weights sum to approximately 100%
      const totalWeight = updatedWeights.reduce((sum, w) => sum + w.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.1) {
        console.warn(`Portfolio weights for fund ${fundId} sum to ${totalWeight}% instead of 100%`);
      }
      
    } catch (error) {
      console.error(`Error recalculating portfolio weights for fund ${fundId}:`, error);
      throw error; // Re-throw to allow calling code to handle
    }
  }

  /**
   * Gets all allocations with enriched data
   * Returns allocations with deal and fund information
   */
  async getAllAllocations(): Promise<any[]> {
    try {
      const allocations = await this.storage.getFundAllocations();
      return allocations;
    } catch (error) {
      console.error('Error fetching all allocations:', error);
      throw error;
    }
  }

  /**
   * Creates a new allocation with proper integration and duplicate handling
   * Ensures all downstream calculations are triggered
   */
  async createAllocation(allocationData: any, userId?: number): Promise<any> {
    try {
      // Check for existing allocation first to prevent duplicate key errors
      console.log(`[ALLOCATION CHECK] Checking for duplicates - Deal ID: ${allocationData.dealId}, Fund ID: ${allocationData.fundId}`);
      
      const existingAllocations = await this.storage.getAllocationsByDeal(allocationData.dealId);
      console.log(`[ALLOCATION CHECK] Found ${existingAllocations.length} existing allocations for deal ${allocationData.dealId}`);
      
      const duplicate = existingAllocations.find(a => a.fundId === allocationData.fundId);
      
      if (duplicate) {
        console.log(`[ALLOCATION CHECK] Found duplicate allocation:`, duplicate);
        return {
          success: false,
          error: `Allocation already exists between this deal and fund (ID: ${duplicate.id})`,
          existingAllocation: duplicate
        };
      }
      
      console.log(`[ALLOCATION CHECK] No duplicate found, proceeding with creation`);
      
      // Create the allocation
      const allocation = await this.storage.createFundAllocation(allocationData);
      
      // Trigger portfolio weight recalculation
      await this.recalculatePortfolioWeights(allocation.fundId);
      
      // Update fund AUM
      await fundService.updateFundAUM(allocation.fundId);
      
      return {
        success: true,
        allocation
      };
    } catch (error) {
      console.error('Error creating allocation:', error);
      
      // Check if it's a database duplicate key error
      if (error instanceof Error && error.message.includes('unique constraint')) {
        return {
          success: false,
          error: 'Allocation already exists for this deal and fund combination'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create allocation'
      };
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