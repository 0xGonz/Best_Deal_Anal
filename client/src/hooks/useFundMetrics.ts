import { useMemo } from 'react';
import { FundAllocation } from '@/lib/types';
import { 
  calculateFundCapitalMetrics, 
  calculateAllocationCapitalMetrics,
  getDisplayAmount,
  CapitalMetrics 
} from '@/lib/services/capitalCalculations';

/**
 * Unified Fund Metrics Hook
 * 
 * Provides a single source of truth for all fund-level calculations
 * ensuring consistency across sector distribution, capital charts, and allocations table.
 * This hook eliminates data inconsistencies by centralizing all metric calculations.
 */
export interface FundMetricsData {
  // Overall fund metrics
  fundMetrics: CapitalMetrics;
  
  // Sector distribution data
  sectorDistribution: {
    sector: string;
    amount: number;
    percentage: number;
    count: number;
  }[];
  
  // Capital view data (changes based on selected view)
  capitalViewData: {
    view: 'total' | 'called' | 'uncalled';
    totalAmount: number;
    calledAmount: number;
    uncalledAmount: number;
    calledPercentage: number;
    uncalledPercentage: number;
  };
  
  // Individual allocation metrics (for weight calculations)
  allocationMetrics: Map<number, {
    capitalMetrics: CapitalMetrics;
    dynamicWeight: number;
  }>;
}

export function useFundMetrics(
  allocations: FundAllocation[], 
  capitalView: 'total' | 'called' | 'uncalled' = 'total'
): FundMetricsData {
  
  return useMemo(() => {
    // Ensure we have valid allocation data
    const validAllocations = allocations?.filter(allocation => 
      allocation && 
      typeof allocation.amount !== 'undefined' && 
      allocation.amount > 0
    ) || [];
    
    if (validAllocations.length === 0) {
      return {
        fundMetrics: { committedAmount: 0, calledAmount: 0, uncalledAmount: 0 },
        sectorDistribution: [],
        capitalViewData: {
          view: capitalView,
          totalAmount: 0,
          calledAmount: 0,
          uncalledAmount: 0,
          calledPercentage: 0,
          uncalledPercentage: 0
        },
        allocationMetrics: new Map()
      };
    }
    
    // Calculate fund-level capital metrics with proper numeric conversion
    const fundMetrics = calculateFundCapitalMetrics(validAllocations);
    
    // Calculate sector distribution based on actual allocation amounts
    const sectorTotals = new Map<string, { amount: number; count: number }>();
    const totalFundAmount = getDisplayAmount(fundMetrics, capitalView);
    
    validAllocations.forEach(allocation => {
      const sector = allocation.dealSector || 'Other';
      const allocationMetrics = calculateAllocationCapitalMetrics(allocation);
      const allocationAmount = getDisplayAmount(allocationMetrics, capitalView);
      
      const current = sectorTotals.get(sector) || { amount: 0, count: 0 };
      sectorTotals.set(sector, {
        amount: current.amount + allocationAmount,
        count: current.count + 1
      });
    });
    
    // Convert to sorted sector distribution array
    const sectorDistribution = Array.from(sectorTotals.entries())
      .map(([sector, data]) => ({
        sector,
        amount: data.amount,
        count: data.count,
        percentage: totalFundAmount > 0 ? (data.amount / totalFundAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
    
    // Calculate capital view data
    const capitalViewData = {
      view: capitalView,
      totalAmount: fundMetrics.committedAmount,
      calledAmount: fundMetrics.calledAmount,
      uncalledAmount: fundMetrics.uncalledAmount,
      calledPercentage: fundMetrics.committedAmount > 0 
        ? (fundMetrics.calledAmount / fundMetrics.committedAmount) * 100 
        : 0,
      uncalledPercentage: fundMetrics.committedAmount > 0 
        ? (fundMetrics.uncalledAmount / fundMetrics.committedAmount) * 100 
        : 0
    };
    
    // Calculate individual allocation metrics for dynamic weights
    const allocationMetrics = new Map();
    validAllocations.forEach(allocation => {
      const capitalMetrics = calculateAllocationCapitalMetrics(allocation);
      const allocationDisplayAmount = getDisplayAmount(capitalMetrics, capitalView);
      const fundDisplayAmount = getDisplayAmount(fundMetrics, capitalView);
      
      const dynamicWeight = fundDisplayAmount > 0 
        ? (allocationDisplayAmount / fundDisplayAmount) * 100 
        : 0;
      
      allocationMetrics.set(allocation.id, {
        capitalMetrics,
        dynamicWeight: isNaN(dynamicWeight) ? 0 : dynamicWeight
      });
    });
    
    return {
      fundMetrics,
      sectorDistribution,
      capitalViewData,
      allocationMetrics
    };
    
  }, [allocations, capitalView]);
}

/**
 * Hook for sector-specific data with real-time updates
 */
export function useSectorDistribution(allocations: FundAllocation[], capitalView: 'total' | 'called' | 'uncalled' = 'total') {
  const { sectorDistribution } = useFundMetrics(allocations, capitalView);
  return sectorDistribution;
}

/**
 * Hook for capital ratio data with real-time updates
 */
export function useCapitalRatio(allocations: FundAllocation[]) {
  const { capitalViewData, fundMetrics } = useFundMetrics(allocations, 'total');
  
  return useMemo(() => ({
    calledCapital: fundMetrics.calledAmount,
    uncalledCapital: fundMetrics.uncalledAmount,
    totalCapital: fundMetrics.committedAmount,
    calledPercentage: capitalViewData.calledPercentage,
    uncalledPercentage: capitalViewData.uncalledPercentage
  }), [fundMetrics, capitalViewData]);
}

/**
 * Hook for dynamic weight calculations that update with capital view
 */
export function useDynamicWeight(
  allocation: FundAllocation, 
  allocations: FundAllocation[], 
  capitalView: 'total' | 'called' | 'uncalled'
): number {
  const { allocationMetrics } = useFundMetrics(allocations, capitalView);
  
  return useMemo(() => {
    const metrics = allocationMetrics.get(allocation.id);
    return metrics?.dynamicWeight || 0;
  }, [allocation.id, allocationMetrics]);
}