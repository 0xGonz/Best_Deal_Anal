/**
 * Allocation Status Management Service
 * 
 * Provides scalable, modular status calculation and validation
 * for fund allocations across the entire application.
 * 
 * This service ensures consistent status logic everywhere and provides
 * real-time validation to catch database inconsistencies.
 */

import type { FundAllocation } from "@/lib/types";

export type AllocationStatus = 'committed' | 'partially_paid' | 'funded' | 'unfunded' | 'written_off';

export interface StatusValidationResult {
  isCorrect: boolean;
  currentStatus: string;
  correctStatus: AllocationStatus;
  paymentPercentage: number;
  errorMessage?: string;
}

export interface AllocationStatusMetrics {
  committed: number;
  partiallyPaid: number;
  funded: number;
  unfunded: number;
  writtenOff: number;
  total: number;
}

/**
 * Core business logic: Calculate what status should be based on payment data
 */
export function calculateCorrectStatus(allocation: FundAllocation): AllocationStatus {
  const amount = Number(allocation.amount) || 0;
  const paidAmount = Number(allocation.paidAmount) || 0;
  
  if (amount === 0) return 'unfunded';
  
  const paymentPercentage = (paidAmount / amount) * 100;
  
  if (paymentPercentage === 0) return 'committed';
  if (paymentPercentage >= 100) return 'funded';
  return 'partially_paid';
}

/**
 * Calculate payment percentage for display purposes
 */
export function getPaymentPercentage(allocation: FundAllocation): number {
  const amount = Number(allocation.amount) || 0;
  const paidAmount = Number(allocation.paidAmount) || 0;
  
  if (amount === 0) return 0;
  return (paidAmount / amount) * 100;
}

/**
 * Validate if allocation status in database matches what it should be
 */
export function validateAllocationStatus(allocation: FundAllocation): StatusValidationResult {
  const correctStatus = calculateCorrectStatus(allocation);
  const paymentPercentage = getPaymentPercentage(allocation);
  const isCorrect = allocation.status === correctStatus;
  
  return {
    isCorrect,
    currentStatus: allocation.status || 'unknown',
    correctStatus,
    paymentPercentage,
    errorMessage: !isCorrect 
      ? `Database shows "${allocation.status}" but should be "${correctStatus}" based on ${paymentPercentage.toFixed(1)}% payment data`
      : undefined
  };
}

/**
 * Get display-friendly status label
 */
export function getStatusDisplayLabel(status: AllocationStatus): string {
  switch (status) {
    case 'partially_paid':
      return 'Partially Paid';
    case 'committed':
      return 'Committed';
    case 'funded':
      return 'Funded';
    case 'unfunded':
      return 'Unfunded';
    case 'written_off':
      return 'Written Off';
    default:
      return 'Unknown';
  }
}

/**
 * Get status color classes for consistent UI styling
 */
export function getStatusColorClass(status: AllocationStatus): string {
  switch (status) {
    case 'funded':
      return 'bg-emerald-100 text-emerald-800';
    case 'partially_paid':
      return 'bg-purple-100 text-purple-800';
    case 'committed':
      return 'bg-blue-100 text-blue-800';
    case 'unfunded':
      return 'bg-amber-100 text-amber-800';
    case 'written_off':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Calculate status distribution metrics for fund overview
 */
export function calculateStatusMetrics(allocations: FundAllocation[]): AllocationStatusMetrics {
  const metrics: AllocationStatusMetrics = {
    committed: 0,
    partiallyPaid: 0,
    funded: 0,
    unfunded: 0,
    writtenOff: 0,
    total: allocations.length
  };
  
  allocations.forEach(allocation => {
    const correctStatus = calculateCorrectStatus(allocation);
    
    switch (correctStatus) {
      case 'committed':
        metrics.committed++;
        break;
      case 'partially_paid':
        metrics.partiallyPaid++;
        break;
      case 'funded':
        metrics.funded++;
        break;
      case 'unfunded':
        metrics.unfunded++;
        break;
      case 'written_off':
        metrics.writtenOff++;
        break;
    }
  });
  
  return metrics;
}

// Removed deprecated findStatusInconsistencies function - no longer needed with database view approach

// Removed deprecated getInconsistencySummary function - no longer needed with database view approach

/**
 * Modular status badge component props generator
 */
export function generateStatusBadgeProps(allocation: FundAllocation): {
  status: AllocationStatus;
  label: string;
  colorClass: string;
  hasError: boolean;
  errorTooltip?: string;
} {
  const validation = validateAllocationStatus(allocation);
  
  return {
    status: validation.correctStatus,
    label: getStatusDisplayLabel(validation.correctStatus),
    colorClass: getStatusColorClass(validation.correctStatus),
    hasError: !validation.isCorrect,
    errorTooltip: validation.errorMessage
  };
}