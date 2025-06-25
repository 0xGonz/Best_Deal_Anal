/**
 * Deal Investment Webhook - Fixed Version
 * Implements idempotent allocation creation to prevent duplicates
 * Respects UNIQUE(fund_id, deal_id) constraint
 */

import { StorageFactory } from '../storage-factory';

export interface DealInvestmentData {
  dealId: number;
  fundId: number;
  amount: number | string;
  securityType: string;
  userId?: number;
}

export class OnDealInvestedFixed {
  private storage = StorageFactory.getStorage();

  /**
   * Handle deal investment with idempotent allocation creation
   * FIXES: Prevents duplicate allocations by checking existing allocations first
   */
  async handleDealInvestment(data: DealInvestmentData): Promise<{
    success: boolean;
    allocation?: any;
    created: boolean;
    error?: string;
  }> {
    try {
      const { dealId, fundId, amount, securityType, userId = 0 } = data;

      // Check for existing allocation - PREVENTS DUPLICATES
      const existingAllocations = await this.storage.getAllocationsByDeal(dealId);
      const existingAllocation = existingAllocations.find(
        allocation => allocation.fundId === fundId
      );

      if (existingAllocation) {
        // Update existing allocation instead of creating duplicate
        const updatedAmount = parseFloat(amount.toString());
        const currentAmount = parseFloat(existingAllocation.amount.toString());
        
        // Only update if the amount is different
        if (updatedAmount !== currentAmount) {
          const updated = await this.storage.updateFundAllocation(existingAllocation.id, {
            amount: updatedAmount.toString(),
            updatedAt: new Date()
          });

          return {
            success: true,
            allocation: updated,
            created: false // Updated existing
          };
        }

        return {
          success: true,
          allocation: existingAllocation,
          created: false // Already exists with same amount
        };
      }

      // Create new allocation - only if none exists
      const newAllocation = await this.storage.createFundAllocation({
        dealId,
        fundId,
        amount: parseFloat(amount.toString()),
        paidAmount: 0,
        amountType: 'dollar',
        securityType,
        allocationDate: new Date(),
        status: 'committed',
        portfolioWeight: 0,
        interestPaid: 0,
        distributionPaid: 0,
        totalReturned: 0,
        marketValue: parseFloat(amount.toString()),
        moic: 1,
        irr: 0
      });

      if (!newAllocation) {
        return {
          success: false,
          created: false,
          error: 'Failed to create allocation'
        };
      }

      // Update deal stage to invested
      await this.updateDealStage(dealId, userId);

      return {
        success: true,
        allocation: newAllocation,
        created: true
      };

    } catch (error) {
      // Handle unique constraint violations gracefully
      if (error instanceof Error && error.message.includes('unique_fund_deal_allocation')) {
        // Try to fetch the existing allocation
        try {
          const existingAllocations = await this.storage.getAllocationsByDeal(data.dealId);
          const existingAllocation = existingAllocations.find(
            allocation => allocation.fundId === data.fundId
          );

          if (existingAllocation) {
            return {
              success: true,
              allocation: existingAllocation,
              created: false
            };
          }
        } catch (fetchError) {
          // Continue to return the original error
        }
      }

      console.error('Error handling deal investment:', error);
      return {
        success: false,
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update deal stage to invested
   */
  private async updateDealStage(dealId: number, userId: number): Promise<void> {
    try {
      await this.storage.updateDeal(dealId, {
        stage: 'invested',
        updatedAt: new Date()
      });

      // Create timeline event
      await this.storage.createTimelineEvent({
        dealId,
        eventType: 'stage_change',
        content: 'Deal moved to Invested stage after allocation creation',
        createdBy: userId,
        createdAt: new Date(),
        metadata: { 
          newStage: 'invested', 
          reason: 'allocation_created',
          automated: true 
        }
      });
    } catch (error) {
      console.error('Error updating deal stage:', error);
      // Don't throw - timeline event is optional
    }
  }

  /**
   * Bulk process multiple deal investments with idempotency
   */
  async bulkProcessDealInvestments(investments: DealInvestmentData[]): Promise<{
    processed: number;
    created: number;
    updated: number;
    errors: string[];
  }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const investment of investments) {
      try {
        const result = await this.handleDealInvestment(investment);
        
        if (result.success) {
          processed++;
          if (result.created) {
            created++;
          } else {
            updated++;
          }
        } else {
          errors.push(`Deal ${investment.dealId}, Fund ${investment.fundId}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Deal ${investment.dealId}, Fund ${investment.fundId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      processed,
      created,
      updated,
      errors
    };
  }
}

// Export singleton instance
export const onDealInvestedService = new OnDealInvestedFixed();