/**
 * Investment Workflow Service
 * 
 * Enterprise-grade investment lifecycle management service that orchestrates
 * the complete investment process from allocation to capital calls with
 * robust error handling, validation, and audit trails.
 */

import { StorageFactory } from '../storage-factory.js';
import { AllocationCreationService } from './allocation-creation.service.js';
import { AllocationStatusService } from './allocation-status.service.js';
import { PaymentWorkflowService } from './payment-workflow.service.js';
import { FundMetricsService } from './fund-metrics.service.js';
import { ValidationService } from './validation.service.js';
import { AuditService } from './audit.service.js';
import { LoggingService } from './LoggingService.js';
import { z } from 'zod';

// Investment workflow schemas
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
  callPercentage: z.number().min(0).max(100).optional(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
  userId: z.number().positive()
});

export interface InvestmentWorkflowContext {
  dealId: number;
  fundId: number;
  allocationId?: number;
  userId: number;
  metadata?: Record<string, any>;
}

export interface WorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
  auditTrail: string[];
}

export class InvestmentWorkflowService {
  private static storage = StorageFactory.getStorage();
  private static logger = LoggingService.getInstance();
  private static audit = new AuditService();

  /**
   * Complete Investment Allocation Workflow
   * Creates allocation, validates constraints, and triggers fund metrics updates
   */
  static async createInvestmentAllocation(
    request: z.infer<typeof InvestmentRequestSchema>
  ): Promise<WorkflowResult> {
    const context: InvestmentWorkflowContext = {
      dealId: request.dealId,
      fundId: request.fundId,
      userId: request.userId,
      metadata: { requestType: 'allocation_creation' }
    };

    const auditTrail: string[] = [];
    
    try {
      // 1. Validate input
      const validationResult = InvestmentRequestSchema.safeParse(request);
      if (!validationResult.success) {
        return {
          success: false,
          error: 'Invalid investment request',
          auditTrail: [`Validation failed: ${validationResult.error.message}`]
        };
      }

      auditTrail.push(`Investment allocation request validated for deal ${request.dealId} to fund ${request.fundId}`);

      // 2. Check business rules and constraints
      const constraintsCheck = await this.validateInvestmentConstraints(context);
      if (!constraintsCheck.valid) {
        return {
          success: false,
          error: constraintsCheck.error,
          auditTrail: [...auditTrail, ...constraintsCheck.auditTrail]
        };
      }

      auditTrail.push(...constraintsCheck.auditTrail);

      // 3. Create allocation using specialized service
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
          error: allocationResult.error,
          auditTrail: [...auditTrail, `Allocation creation failed: ${allocationResult.error}`]
        };
      }

      const allocation = allocationResult.allocation;
      context.allocationId = allocation.id;
      auditTrail.push(`Allocation created with ID ${allocation.id}`);

      // 4. Update deal stage to "invested"
      await this.updateDealStageToInvested(request.dealId, request.userId);
      auditTrail.push(`Deal ${request.dealId} stage updated to "invested"`);

      // 5. Recalculate fund metrics
      await FundMetricsService.recalculateAllMetrics(request.fundId);
      auditTrail.push(`Fund ${request.fundId} metrics recalculated`);

      // 6. Log audit trail
      await this.audit.logWorkflowEvent('investment_allocation_created', context, {
        allocationId: allocation.id,
        amount: request.amount,
        auditTrail
      });

      return {
        success: true,
        data: {
          allocation,
          context,
          nextSteps: ['Consider creating capital calls', 'Monitor fund metrics']
        },
        auditTrail
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      auditTrail.push(`Workflow failed: ${errorMessage}`);
      
      await this.audit.logWorkflowEvent('investment_allocation_failed', context, {
        error: errorMessage,
        auditTrail
      });

      return {
        success: false,
        error: errorMessage,
        auditTrail
      };
    }
  }

  /**
   * Capital Call Creation Workflow
   * Creates capital calls with proper validation and payment tracking
   */
  static async createCapitalCallWorkflow(
    request: z.infer<typeof CapitalCallRequestSchema>
  ): Promise<WorkflowResult> {
    const auditTrail: string[] = [];
    
    try {
      // 1. Validate request
      const validationResult = CapitalCallRequestSchema.safeParse(request);
      if (!validationResult.success) {
        return {
          success: false,
          error: 'Invalid capital call request',
          auditTrail: [`Validation failed: ${validationResult.error.message}`]
        };
      }

      // 2. Get allocation details
      const allocation = await this.storage.getFundAllocation(request.allocationId);
      if (!allocation) {
        return {
          success: false,
          error: 'Allocation not found',
          auditTrail: [`Allocation ${request.allocationId} not found`]
        };
      }

      auditTrail.push(`Capital call workflow started for allocation ${request.allocationId}`);

      // 3. Validate capital call constraints
      const callValidation = await this.validateCapitalCallConstraints(allocation, request.callAmount);
      if (!callValidation.valid) {
        return {
          success: false,
          error: callValidation.error,
          auditTrail: [...auditTrail, ...callValidation.auditTrail]
        };
      }

      // 4. Create capital call
      const capitalCall = await this.storage.createCapitalCall({
        allocationId: request.allocationId,
        callAmount: request.callAmount,
        callDate: new Date(),
        dueDate: new Date(request.dueDate),
        status: 'scheduled',
        notes: request.notes || null,
        created: new Date(),
        createdBy: request.userId
      });

      auditTrail.push(`Capital call created with ID ${capitalCall.id} for amount ${request.callAmount}`);

      // 5. Update allocation status if needed
      await AllocationStatusService.updateAllocationStatus(allocation.id);
      auditTrail.push(`Allocation status updated based on capital call`);

      // 6. Recalculate fund metrics
      await FundMetricsService.recalculateFundCapitalMetrics(allocation.fundId);
      auditTrail.push(`Fund capital metrics recalculated`);

      return {
        success: true,
        data: {
          capitalCall,
          allocation,
          nextSteps: ['Monitor payment due date', 'Track payment status']
        },
        auditTrail
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      auditTrail.push(`Capital call workflow failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        auditTrail
      };
    }
  }

  /**
   * Payment Processing Workflow
   * Handles payment processing with status updates and audit trails
   */
  static async processPaymentWorkflow(
    capitalCallId: number,
    paidAmount: number,
    userId: number,
    paymentDate?: Date
  ): Promise<WorkflowResult> {
    const auditTrail: string[] = [];
    
    try {
      // 1. Process payment using specialized service
      const paymentResult = await PaymentWorkflowService.processPayment({
        capitalCallId,
        paidAmount,
        paymentDate: paymentDate || new Date(),
        userId
      });

      if (!paymentResult.success) {
        return {
          success: false,
          error: paymentResult.error,
          auditTrail: [`Payment processing failed: ${paymentResult.error}`]
        };
      }

      auditTrail.push(`Payment processed for capital call ${capitalCallId}, amount: ${paidAmount}`);

      // 2. Get updated capital call and allocation
      const capitalCall = await this.storage.getCapitalCall(capitalCallId);
      const allocation = await this.storage.getFundAllocation(capitalCall!.allocationId);

      // 3. Update allocation status
      await AllocationStatusService.updateAllocationStatus(allocation!.id);
      auditTrail.push(`Allocation status updated after payment`);

      // 4. Recalculate fund metrics
      await FundMetricsService.recalculateAllMetrics(allocation!.fundId);
      auditTrail.push(`Fund metrics recalculated after payment`);

      return {
        success: true,
        data: {
          payment: paymentResult.payment,
          capitalCall,
          allocation,
          nextSteps: ['Monitor remaining capital calls', 'Review fund performance']
        },
        auditTrail
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      auditTrail.push(`Payment workflow failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        auditTrail
      };
    }
  }

  /**
   * Validate investment constraints
   */
  private static async validateInvestmentConstraints(
    context: InvestmentWorkflowContext
  ): Promise<{ valid: boolean; error?: string; auditTrail: string[] }> {
    const auditTrail: string[] = [];

    try {
      // Check if deal exists and is in appropriate stage
      const deal = await this.storage.getDeal(context.dealId);
      if (!deal) {
        return {
          valid: false,
          error: 'Deal not found',
          auditTrail: [`Deal ${context.dealId} not found`]
        };
      }

      auditTrail.push(`Deal ${context.dealId} found with stage: ${deal.stage}`);

      // Check if fund exists and is active
      const fund = await this.storage.getFund(context.fundId);
      if (!fund) {
        return {
          valid: false,
          error: 'Fund not found',
          auditTrail: [...auditTrail, `Fund ${context.fundId} not found`]
        };
      }

      auditTrail.push(`Fund ${context.fundId} found: ${fund.name}`);

      // Check for existing allocation
      const existingAllocations = await this.storage.getAllocationsByDeal(context.dealId);
      const duplicateAllocation = existingAllocations.find(a => a.fundId === context.fundId);
      
      if (duplicateAllocation) {
        return {
          valid: false,
          error: 'Allocation already exists for this deal and fund combination',
          auditTrail: [...auditTrail, `Duplicate allocation found: ${duplicateAllocation.id}`]
        };
      }

      auditTrail.push('No duplicate allocations found');

      return {
        valid: true,
        auditTrail
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: `Constraint validation failed: ${errorMessage}`,
        auditTrail: [...auditTrail, `Validation error: ${errorMessage}`]
      };
    }
  }

  /**
   * Validate capital call constraints
   */
  private static async validateCapitalCallConstraints(
    allocation: any,
    callAmount: number
  ): Promise<{ valid: boolean; error?: string; auditTrail: string[] }> {
    const auditTrail: string[] = [];

    try {
      // Check if call amount exceeds allocation amount
      if (callAmount > allocation.amount) {
        return {
          valid: false,
          error: 'Capital call amount exceeds allocation amount',
          auditTrail: [`Call amount ${callAmount} exceeds allocation amount ${allocation.amount}`]
        };
      }

      // Check existing capital calls
      const existingCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
      const totalCalled = existingCalls.reduce((sum, call) => sum + call.callAmount, 0);
      
      if (totalCalled + callAmount > allocation.amount) {
        return {
          valid: false,
          error: 'Total capital calls would exceed allocation amount',
          auditTrail: [`Total called amount ${totalCalled + callAmount} would exceed allocation ${allocation.amount}`]
        };
      }

      auditTrail.push(`Capital call validation passed. Total to be called: ${totalCalled + callAmount}/${allocation.amount}`);

      return {
        valid: true,
        auditTrail
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: `Capital call validation failed: ${errorMessage}`,
        auditTrail: [`Validation error: ${errorMessage}`]
      };
    }
  }

  /**
   * Update deal stage to invested
   */
  private static async updateDealStageToInvested(dealId: number, userId: number): Promise<void> {
    await this.storage.updateDeal(dealId, {
      stage: 'invested',
      updatedAt: new Date()
    });

    // Create timeline event
    await this.storage.createTimelineEvent({
      dealId,
      eventType: 'stage_change',
      content: 'Deal moved to Invested stage after allocation creation',
      createdBy: userId,
      createdAt: new Date(),
      metadata: { 
        newStage: 'invested', 
        reason: 'allocation_created',
        automated: true 
      }
    });
  }

  /**
   * Get workflow status for a deal
   */
  static async getWorkflowStatus(dealId: number): Promise<{
    stage: string;
    allocations: any[];
    capitalCalls: any[];
    totalCommitted: number;
    totalCalled: number;
    totalPaid: number;
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

    return {
      stage: deal?.stage || 'unknown',
      allocations,
      capitalCalls,
      totalCommitted,
      totalCalled,
      totalPaid
    };
  }
}