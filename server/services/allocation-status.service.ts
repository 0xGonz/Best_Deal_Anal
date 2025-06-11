/**
 * AllocationStatusService
 * 
 * Ensures allocation status and paidAmount fields remain consistent.
 * This is critical for accurate capital calculations.
 */
export class AllocationStatusService {
  
  /**
   * Calculate the correct status based on amount and paidAmount
   * This ensures data consistency across the system
   */
  static calculateStatus(data: { amount: number; paidAmount: number | null; status?: string }) {
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
    
    return {
      status,
      paidAmount: Math.min(paidAmount, amount), // Cannot exceed committed amount
      paidPercentage
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