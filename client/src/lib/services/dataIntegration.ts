/**
 * Data Integration Service
 * 
 * Ensures all deal data allocated in a fund is fully integrated and connected
 * based on consistent data relationships and validation.
 */

import { FundAllocation, Deal } from '@/lib/types';

export interface DataIntegrityReport {
  isValid: boolean;
  allocationsChecked: number;
  dealsLinked: number;
  missingDealData: {
    allocationId: number;
    dealId: number;
    missingFields: string[];
  }[];
  orphanedAllocations: number[];
  dataConsistencyIssues: {
    type: 'sector_mismatch' | 'name_mismatch' | 'missing_relationship';
    allocationId: number;
    details: string;
  }[];
  summary: string;
}

/**
 * Validates complete data integration between allocations and deals
 */
export function validateDataIntegration(
  allocations: FundAllocation[], 
  deals: Deal[]
): DataIntegrityReport {
  const report: DataIntegrityReport = {
    isValid: true,
    allocationsChecked: allocations.length,
    dealsLinked: 0,
    missingDealData: [],
    orphanedAllocations: [],
    dataConsistencyIssues: [],
    summary: ''
  };

  // Create deal lookup map for efficient access
  const dealMap = new Map(deals.map(deal => [deal.id, deal]));

  for (const allocation of allocations) {
    const linkedDeal = dealMap.get(allocation.dealId);
    
    if (!linkedDeal) {
      // Orphaned allocation - no matching deal found
      report.orphanedAllocations.push(allocation.id);
      report.isValid = false;
      continue;
    }

    report.dealsLinked++;

    // Check for missing critical deal data in allocation
    const missingFields: string[] = [];
    
    if (!allocation.dealName) {
      missingFields.push('dealName');
    }
    
    if (!allocation.dealSector) {
      missingFields.push('dealSector');
    }

    if (missingFields.length > 0) {
      report.missingDealData.push({
        allocationId: allocation.id,
        dealId: allocation.dealId,
        missingFields
      });
      report.isValid = false;
    }

    // Check data consistency between allocation and deal
    if (allocation.dealName && linkedDeal.name && allocation.dealName !== linkedDeal.name) {
      report.dataConsistencyIssues.push({
        type: 'name_mismatch',
        allocationId: allocation.id,
        details: `Allocation has "${allocation.dealName}" but deal has "${linkedDeal.name}"`
      });
      report.isValid = false;
    }

    if (allocation.dealSector && linkedDeal.sector && allocation.dealSector !== linkedDeal.sector) {
      report.dataConsistencyIssues.push({
        type: 'sector_mismatch',
        allocationId: allocation.id,
        details: `Allocation has "${allocation.dealSector}" but deal has "${linkedDeal.sector}"`
      });
      report.isValid = false;
    }
  }

  // Generate summary
  if (report.isValid) {
    report.summary = `✅ All ${report.allocationsChecked} allocations are fully integrated with deal data`;
  } else {
    const issues = [];
    if (report.orphanedAllocations.length > 0) {
      issues.push(`${report.orphanedAllocations.length} orphaned allocations`);
    }
    if (report.missingDealData.length > 0) {
      issues.push(`${report.missingDealData.length} missing deal fields`);
    }
    if (report.dataConsistencyIssues.length > 0) {
      issues.push(`${report.dataConsistencyIssues.length} consistency issues`);
    }
    report.summary = `⚠️ Data integration issues found: ${issues.join(', ')}`;
  }

  return report;
}

/**
 * Ensures allocation has complete deal data integration
 */
export function enrichAllocationWithDealData(
  allocation: FundAllocation, 
  deals: Deal[]
): FundAllocation {
  const linkedDeal = deals.find(deal => deal.id === allocation.dealId);
  
  if (!linkedDeal) {
    return allocation;
  }

  // Enrich allocation with deal data if missing
  return {
    ...allocation,
    dealName: allocation.dealName || linkedDeal.name,
    dealSector: allocation.dealSector || linkedDeal.sector,
  };
}

/**
 * Validates sector distribution data completeness
 */
export function validateSectorDataCompleteness(allocations: FundAllocation[]): {
  complete: boolean;
  missingSectorCount: number;
  totalAllocations: number;
  missingAllocations: number[];
} {
  const missingAllocations: number[] = [];
  
  for (const allocation of allocations) {
    if (!allocation.dealSector || allocation.dealSector.trim() === '') {
      missingAllocations.push(allocation.id);
    }
  }

  return {
    complete: missingAllocations.length === 0,
    missingSectorCount: missingAllocations.length,
    totalAllocations: allocations.length,
    missingAllocations
  };
}

/**
 * Ensures all allocation amounts are properly formatted and consistent
 */
export function validateFinancialDataIntegrity(allocations: FundAllocation[]): {
  valid: boolean;
  issues: {
    allocationId: number;
    field: string;
    issue: string;
    value: any;
  }[];
} {
  const issues: Array<{
    allocationId: number;
    field: string;
    issue: string;
    value: any;
  }> = [];

  for (const allocation of allocations) {
    // Check amount field
    if (typeof allocation.amount !== 'number' || allocation.amount <= 0) {
      issues.push({
        allocationId: allocation.id,
        field: 'amount',
        issue: 'Invalid or non-positive amount',
        value: allocation.amount
      });
    }

    // Check paidAmount consistency
    if (allocation.paidAmount && typeof allocation.paidAmount !== 'number') {
      issues.push({
        allocationId: allocation.id,
        field: 'paidAmount',
        issue: 'Invalid paid amount type',
        value: allocation.paidAmount
      });
    }

    if (allocation.paidAmount && allocation.paidAmount > allocation.amount) {
      issues.push({
        allocationId: allocation.id,
        field: 'paidAmount',
        issue: 'Paid amount exceeds committed amount',
        value: `${allocation.paidAmount} > ${allocation.amount}`
      });
    }

    // Check portfolio weight
    if (allocation.portfolioWeight && (allocation.portfolioWeight < 0 || allocation.portfolioWeight > 100)) {
      issues.push({
        allocationId: allocation.id,
        field: 'portfolioWeight',
        issue: 'Portfolio weight outside valid range (0-100%)',
        value: allocation.portfolioWeight
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}