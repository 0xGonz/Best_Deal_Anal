import type { FundAllocation } from '@/lib/types';

export interface CapitalMetrics {
  committedAmount: number;
  calledAmount: number;
  uncalledAmount: number;
}

/**
 * Calculate capital metrics for a single allocation based on its actual payment data
 * Implements correct business logic: committed → partially_paid → funded
 */
export function calculateAllocationCapitalMetrics(allocation: FundAllocation): CapitalMetrics {
  const committedAmount = allocation.amount;
  const paidAmount = allocation.paidAmount || 0;
  
  // CORRECT BUSINESS LOGIC:
  // - calledAmount = what has been called (equals paidAmount for now, will integrate with capital calls later)
  // - Status should be determined by payment percentage, not used to determine amounts
  // - 0% paid = committed, 0-99% paid = partially_paid, 100% paid = funded
  
  // For now, assume called amount equals paid amount
  // TODO: Integrate with actual capital call data when available
  const calledAmount = paidAmount;
  
  // Calculate what hasn't been called yet
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
 * Calculate what the status SHOULD be based on payment percentage
 * This reveals when database status is incorrect
 */
export function calculateCorrectStatus(allocation: FundAllocation): string {
  const committedAmount = allocation.amount;
  const paidAmount = allocation.paidAmount || 0;
  
  if (committedAmount === 0) return 'unfunded';
  
  const paymentPercentage = (paidAmount / committedAmount) * 100;
  
  if (paymentPercentage === 0) return 'committed';
  if (paymentPercentage >= 100) return 'funded';
  return 'partially_paid';
}

/**
 * Check if allocation status in database matches what it should be
 */
export function isStatusCorrect(allocation: FundAllocation): boolean {
  const correctStatus = calculateCorrectStatus(allocation);
  return allocation.status === correctStatus;
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