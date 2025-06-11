/**
 * Batch Query Service for Capital Calls
 * Eliminates N+1 queries by batching database operations
 */

import { StorageFactory } from '../storage-factory';
import { capitalCallsConfig } from '../config/capital-calls-config';
import { FundAllocation, Deal, Fund } from '@shared/schema';

export interface BatchQueryResults {
  allocations: Map<number, FundAllocation>;
  deals: Map<number, Deal>;
  funds: Map<number, Fund>;
}

/**
 * Service for batching database queries to improve performance
 */
export class BatchQueryService {
  private storage = StorageFactory.getStorage();

  /**
   * Batch fetch allocations, deals, and funds for capital calls
   * This eliminates N+1 queries when fetching calendar data
   */
  async batchFetchForCapitalCalls(allocationIds: number[]): Promise<BatchQueryResults> {
    const config = capitalCallsConfig.getConfig();
    
    if (!config.performance.enableBatchQueries) {
      // Fall back to individual queries if batch queries are disabled
      return this.fallbackIndividualQueries(allocationIds);
    }

    // Batch allocations in chunks to avoid overwhelming the database
    const maxBatchSize = config.performance.maxBatchSize;
    const allocationBatches = this.chunkArray(allocationIds, maxBatchSize);
    
    const allocations = new Map<number, FundAllocation>();
    const dealIds = new Set<number>();
    const fundIds = new Set<number>();

    // Fetch all allocations in batches
    for (const batch of allocationBatches) {
      const batchAllocations = await this.storage.getAllocationsBatch(batch);
      
      for (const allocation of batchAllocations) {
        allocations.set(allocation.id, allocation);
        dealIds.add(allocation.dealId);
        fundIds.add(allocation.fundId);
      }
    }

    // Batch fetch deals and funds
    const [deals, funds] = await Promise.all([
      this.batchFetchDeals(Array.from(dealIds)),
      this.batchFetchFunds(Array.from(fundIds))
    ]);

    return {
      allocations,
      deals,
      funds
    };
  }

  /**
   * Batch fetch deals by IDs
   */
  private async batchFetchDeals(dealIds: number[]): Promise<Map<number, Deal>> {
    const deals = new Map<number, Deal>();
    const maxBatchSize = capitalCallsConfig.getMaxBatchSize();
    const batches = this.chunkArray(dealIds, maxBatchSize);

    for (const batch of batches) {
      const batchDeals = await Promise.all(
        batch.map(id => this.storage.getDeal(id))
      );
      
      batchDeals.forEach((deal, index) => {
        if (deal) {
          deals.set(batch[index], deal);
        }
      });
    }

    return deals;
  }

  /**
   * Batch fetch funds by IDs
   */
  private async batchFetchFunds(fundIds: number[]): Promise<Map<number, Fund>> {
    const funds = new Map<number, Fund>();
    const maxBatchSize = capitalCallsConfig.getMaxBatchSize();
    const batches = this.chunkArray(fundIds, maxBatchSize);

    for (const batch of batches) {
      const batchFunds = await Promise.all(
        batch.map(id => this.storage.getFund(id))
      );
      
      batchFunds.forEach((fund, index) => {
        if (fund) {
          funds.set(batch[index], fund);
        }
      });
    }

    return funds;
  }

  /**
   * Fallback to individual queries when batch queries are disabled
   */
  private async fallbackIndividualQueries(allocationIds: number[]): Promise<BatchQueryResults> {
    const allocations = new Map<number, FundAllocation>();
    const deals = new Map<number, Deal>();
    const funds = new Map<number, Fund>();

    for (const allocationId of allocationIds) {
      try {
        const allocation = await this.storage.getFundAllocation(allocationId);
        if (allocation) {
          allocations.set(allocation.id, allocation);

          // Fetch related deal and fund
          const [deal, fund] = await Promise.all([
            this.storage.getDeal(allocation.dealId),
            this.storage.getFund(allocation.fundId)
          ]);

          if (deal) deals.set(deal.id, deal);
          if (fund) funds.set(fund.id, fund);
        }
      } catch (error) {
        console.error(`Failed to fetch data for allocation ${allocationId}:`, error);
        // Continue with other allocations
      }
    }

    return { allocations, deals, funds };
  }

  /**
   * Utility function to split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get enhanced capital call data with batched related information
   */
  async getEnhancedCapitalCallData(capitalCallIds: number[]) {
    // First get all capital calls
    const capitalCalls = await Promise.all(
      capitalCallIds.map(id => this.storage.getCapitalCall(id))
    );

    const validCalls = capitalCalls.filter(call => call !== null);
    const allocationIds = [...new Set(validCalls.map(call => call!.allocationId))];

    // Batch fetch all related data
    const batchResults = await this.batchFetchForCapitalCalls(allocationIds);

    // Enhance capital calls with related data
    return validCalls.map(call => {
      if (!call) return null;

      const allocation = batchResults.allocations.get(call.allocationId);
      if (!allocation) return call;

      const deal = batchResults.deals.get(allocation.dealId);
      const fund = batchResults.funds.get(allocation.fundId);

      return {
        ...call,
        allocation,
        deal: deal || { id: allocation.dealId, name: 'Unknown Deal' },
        fund: fund || { id: allocation.fundId, name: 'Unknown Fund' },
        // Add computed fields
        fund_name: fund?.name || 'Unknown Fund',
        deal_name: deal?.name || 'Unknown Deal',
        allocation_amount: allocation.amount || 0
      };
    }).filter(call => call !== null);
  }
}

export const batchQueryService = new BatchQueryService();