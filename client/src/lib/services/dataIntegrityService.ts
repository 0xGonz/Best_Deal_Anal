/**
 * Data Integrity Service - Scalable Pattern for Entire App
 * 
 * This service provides the same scalable pattern we used for allocations
 * but extends it to all modules in your investment platform.
 * 
 * Key Features:
 * - Real-time validation for all financial data
 * - Automatic error detection and correction
 * - Consistent business logic across modules
 * - Modular services for each data type
 * - Database-level integrity enforcement
 */

import type { FundAllocation, Deal, Fund, CapitalCall } from "@/lib/types";

// Core validation interface that all modules use
export interface DataValidationResult<T = any> {
  isValid: boolean;
  data: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  correctedData?: T;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestedFix?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  impact: string;
}

// Scalable pattern for any financial data
export interface FinancialDataIntegrity {
  calculateCorrectValues(data: any): any;
  validateData(data: any): DataValidationResult;
  getDisplayMetrics(data: any): any;
  findInconsistencies(dataArray: any[]): any[];
}

/**
 * Capital Call Data Integrity Service
 * Same pattern as allocations, but for capital calls
 */
export class CapitalCallIntegrityService implements FinancialDataIntegrity {
  calculateCorrectValues(capitalCall: CapitalCall) {
    const callAmount = Number(capitalCall.callAmount) || 0;
    const allocationAmount = Number(capitalCall.allocationAmount) || 0;
    const paidAmount = Number(capitalCall.paidAmount) || 0;
    
    // Calculate correct percentage
    const correctCallPercentage = allocationAmount > 0 
      ? (callAmount / allocationAmount) * 100 
      : 0;
    
    // Calculate correct status
    let correctStatus: 'pending' | 'overdue' | 'paid' | 'partial' = 'pending';
    if (paidAmount >= callAmount) {
      correctStatus = 'paid';
    } else if (paidAmount > 0) {
      correctStatus = 'partial';
    } else if (new Date(capitalCall.dueDate) < new Date()) {
      correctStatus = 'overdue';
    }
    
    return {
      ...capitalCall,
      callPercentage: correctCallPercentage,
      status: correctStatus,
      remainingAmount: callAmount - paidAmount
    };
  }
  
  validateData(capitalCall: CapitalCall): DataValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate amounts
    if (capitalCall.callAmount <= 0) {
      errors.push({
        field: 'callAmount',
        message: 'Capital call amount must be positive',
        severity: 'critical',
        suggestedFix: 'Set valid call amount'
      });
    }
    
    if (capitalCall.paidAmount > capitalCall.callAmount) {
      errors.push({
        field: 'paidAmount',
        message: 'Paid amount exceeds call amount',
        severity: 'high',
        suggestedFix: 'Reduce paid amount or increase call amount'
      });
    }
    
    // Validate dates
    const dueDate = new Date(capitalCall.dueDate);
    const callDate = new Date(capitalCall.callDate);
    
    if (dueDate <= callDate) {
      warnings.push({
        field: 'dueDate',
        message: 'Due date should be after call date',
        impact: 'May confuse payment workflow'
      });
    }
    
    const correctedData = this.calculateCorrectValues(capitalCall);
    
    return {
      isValid: errors.length === 0,
      data: capitalCall,
      errors,
      warnings,
      correctedData
    };
  }
  
  getDisplayMetrics(capitalCalls: CapitalCall[]) {
    const total = capitalCalls.length;
    const pending = capitalCalls.filter(cc => cc.status === 'pending').length;
    const paid = capitalCalls.filter(cc => cc.status === 'paid').length;
    const overdue = capitalCalls.filter(cc => cc.status === 'overdue').length;
    const partial = capitalCalls.filter(cc => cc.status === 'partial').length;
    
    const totalCallAmount = capitalCalls.reduce((sum, cc) => sum + Number(cc.callAmount), 0);
    const totalPaidAmount = capitalCalls.reduce((sum, cc) => sum + Number(cc.paidAmount), 0);
    
    return {
      total,
      pending,
      paid,
      overdue,
      partial,
      totalCallAmount,
      totalPaidAmount,
      collectionRate: totalCallAmount > 0 ? (totalPaidAmount / totalCallAmount) * 100 : 0
    };
  }
  
  findInconsistencies(capitalCalls: CapitalCall[]) {
    return capitalCalls
      .map(cc => ({ capitalCall: cc, validation: this.validateData(cc) }))
      .filter(item => !item.validation.isValid || item.validation.warnings.length > 0);
  }
}

/**
 * Deal Data Integrity Service
 * Ensures deal financial data stays consistent
 */
export class DealIntegrityService implements FinancialDataIntegrity {
  calculateCorrectValues(deal: Deal) {
    const targetRaise = Number(deal.targetRaise) || 0;
    const valuation = Number(deal.valuation) || 0;
    const projectedIrr = Number(deal.projectedIrr) || 0;
    const projectedMultiple = Number(deal.projectedMultiple) || 0;
    
    // Calculate derived metrics
    const impliedMultiple = projectedIrr > 0 
      ? Math.pow(1 + (projectedIrr / 100), 5) // Assume 5-year hold
      : projectedMultiple;
    
    return {
      ...deal,
      targetRaise,
      valuation,
      projectedIrr,
      projectedMultiple: impliedMultiple,
      preMoneyValuation: valuation - targetRaise
    };
  }
  
  validateData(deal: Deal): DataValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate financial consistency
    if (deal.targetRaise && deal.valuation && deal.targetRaise > deal.valuation) {
      errors.push({
        field: 'targetRaise',
        message: 'Target raise cannot exceed post-money valuation',
        severity: 'high',
        suggestedFix: 'Adjust valuation or target raise'
      });
    }
    
    // Validate return expectations
    if (deal.projectedIrr && (deal.projectedIrr < 0 || deal.projectedIrr > 100)) {
      warnings.push({
        field: 'projectedIrr',
        message: 'Projected IRR seems unusual',
        impact: 'May indicate data entry error'
      });
    }
    
    const correctedData = this.calculateCorrectValues(deal);
    
    return {
      isValid: errors.length === 0,
      data: deal,
      errors,
      warnings,
      correctedData
    };
  }
  
  getDisplayMetrics(deals: Deal[]) {
    const total = deals.length;
    const avgValuation = deals.reduce((sum, d) => sum + Number(d.valuation || 0), 0) / total;
    const avgTargetRaise = deals.reduce((sum, d) => sum + Number(d.targetRaise || 0), 0) / total;
    const avgProjectedIrr = deals.reduce((sum, d) => sum + Number(d.projectedIrr || 0), 0) / total;
    
    const stageDistribution = deals.reduce((acc, deal) => {
      const stage = deal.stage || 'unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total,
      avgValuation,
      avgTargetRaise,
      avgProjectedIrr,
      stageDistribution
    };
  }
  
  findInconsistencies(deals: Deal[]) {
    return deals
      .map(deal => ({ deal, validation: this.validateData(deal) }))
      .filter(item => !item.validation.isValid || item.validation.warnings.length > 0);
  }
}

/**
 * Fund Performance Integrity Service
 * Ensures fund-level calculations are accurate
 */
export class FundIntegrityService implements FinancialDataIntegrity {
  calculateCorrectValues(fund: Fund) {
    const committedCapital = Number(fund.committedCapital) || 0;
    const calledCapital = Number(fund.calledCapital) || 0;
    const aum = Number(fund.aum) || 0;
    
    // Calculate derived metrics
    const uncalledCapital = committedCapital - calledCapital;
    const deploymentRate = committedCapital > 0 ? (calledCapital / committedCapital) * 100 : 0;
    const utilizationRate = calledCapital > 0 ? (aum / calledCapital) * 100 : 0;
    
    return {
      ...fund,
      uncalledCapital,
      deploymentRate,
      utilizationRate,
      totalFundSize: committedCapital
    };
  }
  
  validateData(fund: Fund): DataValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate capital consistency
    if (fund.calledCapital > fund.committedCapital) {
      errors.push({
        field: 'calledCapital',
        message: 'Called capital exceeds committed capital',
        severity: 'critical',
        suggestedFix: 'Increase committed capital or reduce called capital'
      });
    }
    
    if (fund.aum > fund.calledCapital * 2) {
      warnings.push({
        field: 'aum',
        message: 'AUM significantly exceeds called capital',
        impact: 'May indicate valuation gains or data error'
      });
    }
    
    const correctedData = this.calculateCorrectValues(fund);
    
    return {
      isValid: errors.length === 0,
      data: fund,
      errors,
      warnings,
      correctedData
    };
  }
  
  getDisplayMetrics(funds: Fund[]) {
    const total = funds.length;
    const totalCommitted = funds.reduce((sum, f) => sum + Number(f.committedCapital || 0), 0);
    const totalCalled = funds.reduce((sum, f) => sum + Number(f.calledCapital || 0), 0);
    const totalAum = funds.reduce((sum, f) => sum + Number(f.aum || 0), 0);
    
    return {
      total,
      totalCommitted,
      totalCalled,
      totalAum,
      avgDeploymentRate: totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : 0,
      avgUtilizationRate: totalCalled > 0 ? (totalAum / totalCalled) * 100 : 0
    };
  }
  
  findInconsistencies(funds: Fund[]) {
    return funds
      .map(fund => ({ fund, validation: this.validateData(fund) }))
      .filter(item => !item.validation.isValid || item.validation.warnings.length > 0);
  }
}

/**
 * Master Data Integrity Orchestrator
 * Coordinates validation across all modules
 */
export class MasterDataIntegrityService {
  private allocationService = new AllocationIntegrityService();
  private capitalCallService = new CapitalCallIntegrityService();
  private dealService = new DealIntegrityService();
  private fundService = new FundIntegrityService();
  
  async runFullIntegrityCheck(data: {
    allocations?: FundAllocation[];
    capitalCalls?: CapitalCall[];
    deals?: Deal[];
    funds?: Fund[];
  }) {
    const results = {
      allocations: data.allocations ? this.allocationService.findInconsistencies(data.allocations) : [],
      capitalCalls: data.capitalCalls ? this.capitalCallService.findInconsistencies(data.capitalCalls) : [],
      deals: data.deals ? this.dealService.findInconsistencies(data.deals) : [],
      funds: data.funds ? this.fundService.findInconsistencies(data.funds) : []
    };
    
    const totalIssues = Object.values(results).reduce((sum, issues) => sum + issues.length, 0);
    
    return {
      totalIssues,
      results,
      summary: this.generateIntegritySummary(results),
      recommendations: this.generateRecommendations(results)
    };
  }
  
  private generateIntegritySummary(results: any) {
    return {
      critical: this.countIssuesBySeverity(results, 'critical'),
      high: this.countIssuesBySeverity(results, 'high'),
      medium: this.countIssuesBySeverity(results, 'medium'),
      low: this.countIssuesBySeverity(results, 'low')
    };
  }
  
  private countIssuesBySeverity(results: any, severity: string): number {
    return Object.values(results).reduce((count: number, issues: any[]) => {
      return count + issues.reduce((issueCount, item) => {
        return issueCount + item.validation.errors.filter((e: any) => e.severity === severity).length;
      }, 0);
    }, 0);
  }
  
  private generateRecommendations(results: any): string[] {
    const recommendations: string[] = [];
    
    if (results.allocations.length > 0) {
      recommendations.push('Review allocation status synchronization with capital calls');
    }
    
    if (results.capitalCalls.length > 0) {
      recommendations.push('Audit capital call payment tracking for accuracy');
    }
    
    if (results.deals.length > 0) {
      recommendations.push('Validate deal financial projections and valuations');
    }
    
    if (results.funds.length > 0) {
      recommendations.push('Reconcile fund-level capital calculations');
    }
    
    return recommendations;
  }
}

// Re-export the allocation service for backwards compatibility
export { AllocationIntegrityService } from './allocationStatusService';