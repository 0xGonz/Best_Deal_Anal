/**
 * Hook for fetching comprehensive fund overview data
 * Single source of truth for all fund metrics calculated at database level
 */

import { useQuery } from '@tanstack/react-query';

export interface FundOverviewData {
  fundId: number;
  fundName: string;
  targetSize: number;
  vintage: number;
  aum: number;
  committed: number;
  called: number;
  uncalled: number;
  weightPct: number;
  allocationCount: number;
  totalPaid: number;
  totalMarketValue: number;
  portfolioMoic: number;
  totalInterestPaid: number;
  totalDistributionPaid: number;
}

/**
 * Fetch overview data for a specific fund
 */
export function useFundOverview(fundId: number | string) {
  return useQuery({
    queryKey: ['fund-overview', fundId],
    enabled: !!fundId,
    staleTime: 0, // Always refetch on window focus for real-time feel
  });
}

/**
 * Fetch overview data for all funds
 */
export function useAllFundsOverview() {
  return useQuery({
    queryKey: ['fund-overview'],
    staleTime: 0, // Always refetch on window focus for real-time feel
  });
}

/**
 * Format numbers for display
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}