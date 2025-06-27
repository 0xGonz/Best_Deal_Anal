/**
 * Production Investment Manager Service
 * 
 * Central service that provides a clean, production-ready API for all investment operations.
 * This service acts as the main entry point for investment allocation and capital call workflows.
 */

import { StorageFactory } from '../storage-factory.js';
import { investmentConfig } from '../config/investment-config.js';
import { AuditService } from './audit.service.js';
import { AllocationCreationService } from './allocation-creation.service.js';
import { FundMetricsService } from './fund-metrics.service.js';
import { LoggingService } from './LoggingService.js';
import { z } from 'zod';

const InvestmentRequestSchema = z.object({
  dealId: z.number().positive(),
  fundId: z.number().positive(),
  amount: z.number().positive(),
  securityType: z.string().default('equity'),
  amountType: z.enum(['percentage', 'dollar', 'committed']).default('committed'),
  userId: z.number().positive()
});

const CapitalCallRequestSchema = z.object({
  allocationId: z.number().positive(),
  callAmount: z.number().positive(),
  dueDate: z.string(),
  notes: z.string().optional(),
  userId: z.number().positive()
});

const PaymentRequestSchema = z.object({
  capitalCallId: z.number().positive(),
  paidAmount: z.number().positive(),
  paymentDate: z.string().optional(),
  userId: z.number().positive()
});

export interface InvestmentResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
  nextSteps?: string[];
}

export class ProductionInvestmentManager {
  private static storage = StorageFactory.getStorage();
  private static audit = new AuditService();
  private static logger = LoggingService.getInstance();

  /**
   * Create Investment Allocation - Production Ready
   */
  static async createInvestmentAllocation(
    request: z.infer<typeof InvestmentRequestSchema>
  ): Promise<InvestmentResult> {
    try {
      const validation = InvestmentRequestSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          error: 'Invalid investment request parameters'
        };
      }

      // Validate business constraints
      const constraints = await this.validateInvestmentConstraints(request);
      if (!constraints.valid) {
        return {
          success: false,
          error: constraints.error,
          nextSteps: constraints.recommendations
        };
      }

      // Create allocation
      const allocationResult = await AllocationCreationService.createAllocation({
        dealId: request.dealId,
        fundId: request.fundId,
        amount: request.amount,
        securityType: request.securityType,
        amountType: request.amountType,
        userId: request.userId
      });

      if (!allocationResult.success) {
        return {
          success: false,
          error: allocationResult.error
        };
      }

      // Update deal stage
      await this.storage.updateDeal(request.dealId, {
        stage: 'invested'
      });

      // Recalculate fund metrics
      await FundMetricsService.recalculateAllMetrics(request.fundId);

      // Log audit event
      await this.audit.logWorkflowEvent('investment_allocation_created', {
        dealId: request.dealId,
        fundId: request.fundId,
        allocationId: allocationResult.allocation.id,
        userId: request.userId
      }, {
        allocation: allocationResult.allocation
      });

      return {
        success: true,
        data: {
          allocation: allocationResult.allocation,
          dealStage: 'invested'
        },
        nextSteps: [
          'Consider creating capital calls',
          'Monitor fund performance metrics'
        ]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Investment allocation creation failed', { error, request });
      
      return {
        success: false,
        error: `Investment allocation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Create Capital Call - Production Ready
   */
  static async createCapitalCall(
    request: z.infer<typeof CapitalCallRequestSchema>
  ): Promise<InvestmentResult> {
    try {
      const validation = CapitalCallRequestSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          error: 'Invalid capital call request parameters'
        };
      }

      // Get allocation details
      const allocation = await this.storage.getFundAllocation(request.allocationId);
      if (!allocation) {
        return {
          success: false,
          error: 'Allocation not found'
        };
      }

      // Validate capital call constraints
      const constraints = await this.validateCapitalCallConstraints(allocation, request.callAmount);
      if (!constraints.valid) {
        return {
          success: false,
          error: constraints.error
        };
      }

      // Create capital call
      const capitalCall = await this.storage.createCapitalCall({
        allocationId: request.allocationId,
        callAmount: request.callAmount,
        callDate: new Date(),
        dueDate: new Date(request.dueDate),
        status: 'scheduled',
        outstanding_amount: request.callAmount.toString(),
        notes: request.notes || null,
        callPct: null,
        paidAmount: null,
        amountType: null
      });

      // Update fund metrics
      await FundMetricsService.recalculateFundCapitalMetrics(allocation.fundId);

      // Log audit event
      await this.audit.logWorkflowEvent('capital_call_created', {
        allocationId: request.allocationId,
        userId: request.userId
      }, {
        capitalCall
      });

      return {
        success: true,
        data: {
          capitalCall,
          allocation
        },
        nextSteps: [
          'Monitor payment due date',
          'Track payment collection'
        ]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Capital call creation failed', { error, request });
      
      return {
        success: false,
        error: `Capital call creation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Process Payment - Production Ready
   */
  static async processPayment(
    request: z.infer<typeof PaymentRequestSchema>
  ): Promise<InvestmentResult> {
    try {
      const validation = PaymentRequestSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          error: 'Invalid payment request parameters'
        };
      }

      // Get capital call
      const capitalCall = await this.storage.getCapitalCall(request.capitalCallId);
      if (!capitalCall) {
        return {
          success: false,
          error: 'Capital call not found'
        };
      }

      // Validate payment amount
      const outstandingAmount = parseFloat(capitalCall.outstanding_amount || '0');
      if (request.paidAmount > outstandingAmount) {
        return {
          success: false,
          error: 'Payment amount exceeds outstanding balance'
        };
      }

      // Update capital call with payment
      const newOutstanding = outstandingAmount - request.paidAmount;
      const newPaidAmount = (capitalCall.paidAmount || 0) + request.paidAmount;
      
      let newStatus = capitalCall.status;
      if (newOutstanding <= 0) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partially_paid';
      }

      await this.storage.updateCapitalCall(request.capitalCallId, {
        paidAmount: newPaidAmount,
        outstanding_amount: newOutstanding.toString(),
        status: newStatus
      });

      // Get allocation and update fund metrics
      const allocation = await this.storage.getFundAllocation(capitalCall.allocationId);
      if (allocation) {
        await FundMetricsService.recalculateAllMetrics(allocation.fundId);
      }

      // Log audit event
      await this.audit.logWorkflowEvent('payment_processed', {
        allocationId: capitalCall.allocationId,
        userId: request.userId
      }, {
        capitalCallId: request.capitalCallId,
        paidAmount: request.paidAmount,
        newStatus
      });

      return {
        success: true,
        data: {
          capitalCall: {
            ...capitalCall,
            paidAmount: newPaidAmount,
            outstanding_amount: newOutstanding.toString(),
            status: newStatus
          },
          allocation
        },
        nextSteps: [
          'Monitor remaining capital calls',
          'Review fund performance'
        ]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Payment processing failed', { error, request });
      
      return {
        success: false,
        error: `Payment processing failed: ${errorMessage}`
      };
    }
  }

  /**
   * Get Investment Status
   */
  static async getInvestmentStatus(dealId: number): Promise<{
    deal: any;
    allocations: any[];
    capitalCalls: any[];
    totalCommitted: number;
    totalCalled: number;
    totalPaid: number;
    collectionRate: number;
  }> {
    const deal = await this.storage.getDeal(dealId);
    const allocations = await this.storage.getAllocationsByDeal(dealId);
    
    let capitalCalls: any[] = [];
    for (const allocation of allocations) {
      const calls = await this.storage.getCapitalCallsByAllocation(allocation.id);
      capitalCalls = [...capitalCalls, ...calls];
    }

    const totalCommitted = allocations.reduce((sum, a) => sum + a.amount, 0);
    const totalCalled = capitalCalls.reduce((sum, c) => sum + c.callAmount, 0);
    const totalPaid = capitalCalls.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
    const collectionRate = totalCalled > 0 ? (totalPaid / totalCalled) * 100 : 0;

    return {
      deal,
      allocations,
      capitalCalls,
      totalCommitted,
      totalCalled,
      totalPaid,
      collectionRate
    };
  }

  /**
   * Get Fund Performance Summary
   */
  static async getFundPerformance(fundId: number): Promise<{
    fund: any;
    allocations: any[];
    totalCommitted: number;
    totalCalled: number;
    totalPaid: number;
    outstandingCommitments: number;
    collectionRate: number;
  }> {
    const fund = await this.storage.getFund(fundId);
    const allocations = await this.storage.getAllocationsByFund(fundId);
    
    let totalCalled = 0;
    let totalPaid = 0;
    
    for (const allocation of allocations) {
      const calls = await this.storage.getCapitalCallsByAllocation(allocation.id);
      totalCalled += calls.reduce((sum, c) => sum + c.callAmount, 0);
      totalPaid += calls.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
    }

    const totalCommitted = allocations.reduce((sum, a) => sum + a.amount, 0);
    const outstandingCommitments = totalCommitted - totalCalled;
    const collectionRate = totalCalled > 0 ? (totalPaid / totalCalled) * 100 : 0;

    return {
      fund,
      allocations,
      totalCommitted,
      totalCalled,
      totalPaid,
      outstandingCommitments,
      collectionRate
    };
  }

  /**
   * Private Helper Methods
   */
  private static async validateInvestmentConstraints(
    request: z.infer<typeof InvestmentRequestSchema>
  ): Promise<{ valid: boolean; error?: string; recommendations?: string[] }> {
    // Check amount constraints
    if (!investmentConfig.isAmountValid(request.amount)) {
      const limits = investmentConfig.getLimits();
      return {
        valid: false,
        error: `Investment amount must be between ${limits.minAllocationAmount} and ${limits.maxAllocationAmount}`,
        recommendations: ['Adjust investment amount to within limits']
      };
    }

    // Check for duplicate allocations
    const existingAllocations = await this.storage.getAllocationsByDeal(request.dealId);
    const duplicateAllocation = existingAllocations.find(a => a.fundId === request.fundId);
    
    if (duplicateAllocation) {
      return {
        valid: false,
        error: 'Allocation already exists for this deal and fund combination',
        recommendations: ['Use existing allocation', 'Update existing allocation amount']
      };
    }

    return { valid: true };
  }

  private static async validateCapitalCallConstraints(
    allocation: any,
    callAmount: number
  ): Promise<{ valid: boolean; error?: string }> {
    // Check if call amount exceeds allocation
    if (callAmount > allocation.amount) {
      return {
        valid: false,
        error: 'Capital call amount exceeds allocation amount'
      };
    }

    // Check existing capital calls
    const existingCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
    const totalCalled = existingCalls.reduce((sum, call) => sum + call.callAmount, 0);
    
    if (totalCalled + callAmount > allocation.amount) {
      return {
        valid: false,
        error: 'Total capital calls would exceed allocation amount'
      };
    }

    return { valid: true };
  }
}