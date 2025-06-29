import { StorageFactory } from '../storage-factory.js';

/**
 * AllocationStatusService
 * 
 * Ensures allocation status and paidAmount fields remain consistent.
 * This is critical for accurate capital calculations.
 */
export class AllocationStatusService {
  
  /**
   * Validate a payment against an allocation
   * Prevents negative payments and overpayments
   */
  static validatePayment(allocation: any, amount: number): { isValid: boolean; error?: string } {
    if (amount <= 0) {
      return { isValid: false, error: 'Payment must be positive' };
    }
    
    const currentPaid = allocation.paidAmount || 0;
    if (currentPaid + amount > allocation.amount) {
      return { isValid: false, error: 'Payment exceeds commitment' };
    }
    
    return { isValid: true };
  }
  
  /**
   * Update allocation status based on capital call payments
   * This is the critical synchronization method identified in the forensic analysis
   */
  static async updateAllocationStatus(allocationId: number): Promise<void> {
    try {
      const storage = StorageFactory.getStorage();
      
      // 1. Get current allocation
      const allocation = await storage.getFundAllocation(allocationId);
      if (!allocation) {
        console.warn(`Allocation ${allocationId} not found`);
        return;
      }
      
      // 2. Sum all capital call payments for this allocation
      const capitalCalls = await storage.getCapitalCallsByAllocation(allocationId);
      let totalPaidAmount = 0;
      
      for (const call of capitalCalls) {
        if (call.paidAmount && call.paidAmount > 0) {
          totalPaidAmount += call.paidAmount;
        }
      }
      
      // 3. Calculate correct status using our calculator
      const statusResult = this.calculateStatus({
        amount: allocation.amount,
        paidAmount: totalPaidAmount,
        status: allocation.status || 'committed'
      });
      
      // 4. Update allocation if changes are needed
      const needsUpdate = 
        allocation.paidAmount !== statusResult.paidAmount || 
        allocation.status !== statusResult.status;
        
      if (needsUpdate) {
        await storage.updateFundAllocation(allocationId, {
          paidAmount: statusResult.paidAmount,
          status: statusResult.status
        });
        
        console.log(`✅ Updated allocation ${allocationId}:`);
        console.log(`  Paid Amount: ${allocation.paidAmount || 0} → ${statusResult.paidAmount}`);
        console.log(`  Status: ${allocation.status} → ${statusResult.status}`);
        console.log(`  Progress: ${statusResult.paidPercentage.toFixed(1)}% paid`);
      }
      
    } catch (error) {
      console.error(`Failed to update allocation status for ${allocationId}:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate the correct status based on amount and paidAmount
   * This ensures data consistency across the system
   */
  static calculateStatus(data: { amount: number; paidAmount: number | null; status?: string | null }) {
    const amount = Number(data.amount) || 0;
    const paidAmount = Number(data.paidAmount) || 0;
    
    if (amount === 0) {
      return {
        status: 'unfunded' as const,
        paidAmount: 0,
        paidPercentage: 0
      };
    }
    
    const paidPercentage = (paidAmount / amount) * 100;
    
    // Determine status based on payment percentage
    let status: 'committed' | 'partially_paid' | 'funded' | 'unfunded';
    
    if (paidPercentage >= 100) {
      status = 'funded';
    } else if (paidPercentage > 0) {
      status = 'partially_paid';
    } else {
      status = 'committed';
    }
    
    const finalPaidAmount = Math.min(paidAmount, amount);
    return {
      status,
      paidAmount: finalPaidAmount,
      paidPercentage,
      remainingAmount: Math.max(0, amount - finalPaidAmount)
    };
  }
  
  /**
   * Sync paidAmount with status for data consistency
   * When status is set to 'funded', paidAmount should equal amount
   */
  static syncPaidAmountWithStatus(data: { amount: number; status: string; paidAmount?: number }) {
    const amount = Number(data.amount) || 0;
    let paidAmount = Number(data.paidAmount) || 0;
    
    switch (data.status) {
      case 'funded':
        // Funded means 100% paid
        paidAmount = amount;
        break;
        
      case 'committed':
      case 'unfunded':
        // Not called/paid yet
        paidAmount = 0;
        break;
        
      case 'partially_paid':
        // Keep existing paidAmount, but ensure it's within bounds
        paidAmount = Math.min(Math.max(paidAmount, 0), amount);
        break;
    }
    
    return {
      ...data,
      paidAmount,
      amount
    };
  }
}