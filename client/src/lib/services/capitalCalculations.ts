import type { FundAllocation } from '@/lib/types';

export interface CapitalMetrics {
  committedAmount: number;
  calledAmount: number;
  uncalledAmount: number;
}

/**
 * Calculate capital metrics for a single allocation based on its status and capital call history
 * This is a scalable service that can be extended to integrate with actual capital call data
 */
export function calculateAllocationCapitalMetrics(allocation: FundAllocation): CapitalMetrics {
  const committedAmount = allocation.amount;
  
  // Use the correct field mapping from API response:
  // - paidAmount = actual capital that has been called and paid
  // - For funded allocations, called capital equals paid capital (all called capital is paid)
  // - For partially_paid allocations, some capital is called but not fully paid
  // - For committed allocations, no capital has been called yet
  
  let calledAmount = 0;
  if (allocation.status === 'funded') {
    // For funded allocations, we assume all paid amount represents called capital
    calledAmount = allocation.paidAmount || 0;
  } else if (allocation.status === 'partially_paid') {
    // For partially paid, the paid amount is the called amount (since paid <= called)
    calledAmount = allocation.paidAmount || 0;
  } else {
    // For committed/unfunded, no capital has been called
    calledAmount = 0;
  }
  
  const uncalledAmount = committedAmount - calledAmount;
  
  return {
    committedAmount,
    calledAmount,
    uncalledAmount
  };
}

/**
 * Calculate fund-level capital metrics by aggregating all allocations
 */
export function calculateFundCapitalMetrics(allocations: FundAllocation[]): CapitalMetrics {
  return allocations.reduce(
    (totals, allocation) => {
      const metrics = calculateAllocationCapitalMetrics(allocation);
      return {
        committedAmount: totals.committedAmount + metrics.committedAmount,
        calledAmount: totals.calledAmount + metrics.calledAmount,
        uncalledAmount: totals.uncalledAmount + metrics.uncalledAmount
      };
    },
    { committedAmount: 0, calledAmount: 0, uncalledAmount: 0 }
  );
}

/**
 * Get display amount based on capital view selection
 */
export function getDisplayAmount(
  metrics: CapitalMetrics, 
  view: 'total' | 'called' | 'uncalled'
): number {
  switch (view) {
    case 'called':
      return metrics.calledAmount;
    case 'uncalled':
      return metrics.uncalledAmount;
    case 'total':
    default:
      return metrics.committedAmount;
  }
}

/**
 * Get color class based on capital view selection
 */
export function getCapitalViewColorClass(view: 'total' | 'called' | 'uncalled'): string {
  switch (view) {
    case 'called':
      return 'text-green-700 font-medium';
    case 'uncalled':
      return 'text-orange-700 font-medium';
    case 'total':
    default:
      return 'text-blue-700 font-medium';
  }
}

/**
 * Calculate dynamic portfolio weight based on capital view
 * Weight adjusts based on whether you're viewing committed, called, or uncalled capital
 */
export function calculateDynamicWeight(
  allocation: FundAllocation,
  allAllocations: FundAllocation[],
  capitalView: 'total' | 'called' | 'uncalled'
): number {
  // Calculate total fund metrics for the denominator
  const fundMetrics = calculateFundCapitalMetrics(allAllocations);
  const allocationMetrics = calculateAllocationCapitalMetrics(allocation);
  
  // Get the appropriate amounts based on view
  const allocationAmount = getDisplayAmount(allocationMetrics, capitalView);
  const totalFundAmount = getDisplayAmount(fundMetrics, capitalView);
  
  // Calculate weight as percentage of total
  if (totalFundAmount === 0) return 0;
  return (allocationAmount / totalFundAmount) * 100;
}