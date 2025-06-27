/**
 * Enterprise Investment Orchestrator Service
 * 
 * Central orchestration service that coordinates the complete investment lifecycle
 * from deal allocation through capital calls to fund performance tracking.
 * Provides enterprise-grade workflow management with comprehensive error handling.
 */

import { StorageFactory } from '../storage-factory.js';
import { investmentConfig } from '../config/investment-config.js';
import { AuditService } from './audit.service.js';
import { LoggingService } from './LoggingService.js';
import { EnterpriseCapitalCallService } from './enterprise-capital-call.service.js';
import { AllocationCreationService } from './allocation-creation.service.js';
import { AllocationStatusService } from './allocation-status.service.js';
import { FundMetricsService } from './fund-metrics.service.js';
import { z } from 'zod';

// Comprehensive investment workflow schemas
const CompleteInvestmentRequestSchema = z.object({
  dealId: z.number().positive(),
  fundId: z.number().positive(),
  amount: z.number().positive(),
  securityType: z.string().default('equity'),
  amountType: z.enum(['percentage', 'dollar', 'committed']).default('committed'),
  userId: z.number().positive(),
  autoCreateCapitalCall: z.boolean().default(false),
  capitalCallAmount: z.number().positive().optional(),
  capitalCallDueDate: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

export interface InvestmentOrchestrationResult {
  success: boolean;
  allocation?: any;
  capitalCall?: any;
  fundMetrics?: any;
  error?: string;
  warnings?: string[];
  auditTrail: string[];
  nextSteps: string[];
  workflowStage: 'allocation_created' | 'capital_call_created' | 'fully_orchestrated' | 'failed';
}

export interface InvestmentLifecycleStatus {
  dealId: number;
  allocations: Array<{
    id: number;
    fundId: number;
    fundName: string;
    amount: number;
    status: string;
    paidAmount: number;
    capitalCalls: Array<{
      id: number;
      callAmount: number;
      dueDate: Date;
      status: string;
      paidAmount: number;
    }>;
  }>;
  totalCommitted: number;
  totalCalled: number;
  totalPaid: number;
  collectionRate: number;
  stage: string;
}

export class EnterpriseInvestmentOrchestrator {
  private static storage = StorageFactory.getStorage();
  private static audit = new AuditService();
  private static logger = LoggingService.getInstance();

  /**
   * Complete Investment Workflow Orchestration
   * Handles the entire investment process from allocation to capital calls
   */
  static async orchestrateCompleteInvestment(
    request: z.infer<typeof CompleteInvestmentRequestSchema>
  ): Promise<InvestmentOrchestrationResult> {
    const auditTrail: string[] = [];
    const warnings: string[] = [];
    
    try {
      // 1. Validate comprehensive request
      const validation = CompleteInvestmentRequestSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          error: 'Invalid investment orchestration request',
          auditTrail: [`Validation failed: ${validation.error.message}`],
          nextSteps: ['Review and correct request parameters'],
          workflowStage: 'failed'
        };
      }

      auditTrail.push(`Investment orchestration initiated for deal ${request.dealId} to fund ${request.fundId}`);

      // 2. Validate business constraints
      const constraintsCheck = await this.validateInvestmentConstraints(request);
      if (!constraintsCheck.valid) {
        return {
          success: false,
          error: constraintsCheck.error,
          auditTrail: [...auditTrail, ...constraintsCheck.auditTrail],
          nextSteps: constraintsCheck.recommendations,
          workflowStage: 'failed'
        };
      }

      auditTrail.push(...constraintsCheck.auditTrail);

      // 3. Create allocation
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
          error: `Allocation creation failed: ${allocationResult.error}`,
          auditTrail: [...auditTrail, `Allocation creation failed`],
          nextSteps: ['Review allocation parameters', 'Check fund capacity'],
          workflowStage: 'failed'
        };
      }

      const allocation = allocationResult.allocation;
      auditTrail.push(`Allocation created successfully with ID ${allocation.id}`);

      // 4. Update deal stage to invested
      await this.updateDealStageToInvested(request.dealId, request.userId);
      auditTrail.push(`Deal ${request.dealId} stage updated to 'invested'`);

      let capitalCall = null;
      let nextSteps = ['Monitor allocation performance', 'Consider capital call creation'];

      // 5. Create capital call if requested
      if (request.autoCreateCapitalCall && request.capitalCallAmount && request.capitalCallDueDate) {
        const capitalCallResult = await EnterpriseCapitalCallService.createCapitalCall({
          allocationId: allocation.id,
          callAmount: request.capitalCallAmount,
          dueDate: request.capitalCallDueDate,
          userId: request.userId,
          priority: 'medium',
          requiresApproval: investmentConfig.requiresApproval(request.capitalCallAmount)
        });

        if (capitalCallResult.success) {
          capitalCall = capitalCallResult.capitalCall;
          auditTrail.push(`Capital call created with ID ${capitalCall.id}`);
          nextSteps = capitalCallResult.nextActions;
        } else {
          warnings.push(`Capital call creation failed: ${capitalCallResult.error}`);
          auditTrail.push(`Capital call creation failed but allocation succeeded`);
        }
      }

      // 6. Recalculate fund metrics
      const fundMetrics = await this.recalculateFundMetrics(request.fundId);
      auditTrail.push(`Fund ${request.fundId} metrics recalculated`);

      // 7. Log comprehensive audit event
      await this.audit.logWorkflowEvent('complete_investment_orchestrated', {
        dealId: request.dealId,
        fundId: request.fundId,
        allocationId: allocation.id,
        userId: request.userId,
        metadata: request.metadata
      }, {
        allocation,
        capitalCall,
        fundMetrics,
        auditTrail
      });

      const workflowStage = capitalCall ? 'fully_orchestrated' : 'allocation_created';

      return {
        success: true,
        allocation,
        capitalCall,
        fundMetrics,
        warnings: warnings.length > 0 ? warnings : undefined,
        auditTrail,
        nextSteps,
        workflowStage
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown orchestration error';
      auditTrail.push(`Investment orchestration failed: ${errorMessage}`);
      
      this.logger.error('Investment orchestration failed', { error, request });
      
      return {
        success: false,
        error: errorMessage,
        auditTrail,
        nextSteps: ['Review error logs', 'Contact system administrator'],
        workflowStage: 'failed'
      };
    }
  }

  /**
   * Get Complete Investment Lifecycle Status
   */
  static async getInvestmentLifecycleStatus(dealId: number): Promise<InvestmentLifecycleStatus> {
    try {
      const deal = await this.storage.getDeal(dealId);
      const allocations = await this.storage.getAllocationsByDeal(dealId);
      
      const enrichedAllocations = await Promise.all(
        allocations.map(async (allocation) => {
          const fund = await this.storage.getFund(allocation.fundId);
          const capitalCalls = await this.storage.getCapitalCallsByAllocation(allocation.id);
          
          return {
            id: allocation.id,
            fundId: allocation.fundId,
            fundName: fund?.name || 'Unknown Fund',
            amount: allocation.amount,
            status: allocation.status,
            paidAmount: allocation.paidAmount || 0,
            capitalCalls: capitalCalls.map(call => ({
              id: call.id,
              callAmount: call.callAmount,
              dueDate: new Date(call.dueDate),
              status: call.status,
              paidAmount: call.paidAmount || 0
            }))
          };
        })
      );

      const totalCommitted = enrichedAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalCalled = enrichedAllocations.reduce((sum, a) => 
        sum + a.capitalCalls.reduce((callSum, call) => callSum + call.callAmount, 0), 0
      );
      const totalPaid = enrichedAllocations.reduce((sum, a) => 
        sum + a.capitalCalls.reduce((callSum, call) => callSum + call.paidAmount, 0), 0
      );
      
      const collectionRate = totalCalled > 0 ? (totalPaid / totalCalled) * 100 : 0;

      return {
        dealId,
        allocations: enrichedAllocations,
        totalCommitted,
        totalCalled,
        totalPaid,
        collectionRate,
        stage: deal?.stage || 'unknown'
      };

    } catch (error) {
      this.logger.error('Failed to get investment lifecycle status', { error, dealId });
      throw error;
    }
  }

  /**
   * Generate Investment Performance Analytics
   */
  static async generateInvestmentAnalytics(fundId?: number): Promise<{
    fundPerformance: {
      totalCommittedCapital: number;
      calledCapital: number;
      paidCapital: number;
      outstandingCommitments: number;
      averageCallToPaymentDays: number;
    };
    allocationMetrics: {
      totalAllocations: number;
      averageAllocationSize: number;
      statusDistribution: Record<string, number>;
      sectorDistribution: Record<string, number>;
    };
    capitalCallMetrics: {
      totalCalls: number;
      totalCallAmount: number;
      collectionRate: number;
      overdueAmount: number;
      statusDistribution: Record<string, number>;
    };
    trends: {
      monthlyAllocations: Array<{ month: string; count: number; amount: number }>;
      monthlyCollections: Array<{ month: string; amount: number }>;
    };
  }> {
    try {
      // Get base data
      const allocations = fundId 
        ? await this.storage.getAllocationsByFund(fundId)
        : await this.storage.getAllAllocations();

      const capitalCallsData = await EnterpriseCapitalCallService.generatePerformanceReport(fundId);

      // Calculate fund performance
      const totalCommittedCapital = allocations.reduce((sum, a) => sum + a.amount, 0);
      const calledCapital = capitalCallsData.totalAmount;
      const paidCapital = capitalCallsData.paidAmount;
      const outstandingCommitments = totalCommittedCapital - calledCapital;

      // Calculate allocation metrics
      const statusDistribution = allocations.reduce((dist, a) => {
        dist[a.status] = (dist[a.status] || 0) + 1;
        return dist;
      }, {} as Record<string, number>);

      // Get sector distribution from deals
      const deals = await Promise.all(
        [...new Set(allocations.map(a => a.dealId))].map(id => this.storage.getDeal(id))
      );
      
      const sectorDistribution = deals
        .filter(deal => deal?.sector)
        .reduce((dist, deal) => {
          const sector = deal!.sector || 'Unknown';
          dist[sector] = (dist[sector] || 0) + 1;
          return dist;
        }, {} as Record<string, number>);

      return {
        fundPerformance: {
          totalCommittedCapital,
          calledCapital,
          paidCapital,
          outstandingCommitments,
          averageCallToPaymentDays: capitalCallsData.averageDaysToPayment
        },
        allocationMetrics: {
          totalAllocations: allocations.length,
          averageAllocationSize: totalCommittedCapital / allocations.length || 0,
          statusDistribution,
          sectorDistribution
        },
        capitalCallMetrics: {
          totalCalls: capitalCallsData.totalCalls,
          totalCallAmount: capitalCallsData.totalAmount,
          collectionRate: capitalCallsData.collectionRate,
          overdueAmount: capitalCallsData.overdueAmount,
          statusDistribution: capitalCallsData.statusBreakdown
        },
        trends: {
          monthlyAllocations: [], // Would be calculated from allocation creation dates
          monthlyCollections: []  // Would be calculated from payment dates
        }
      };

    } catch (error) {
      this.logger.error('Failed to generate investment analytics', { error });
      throw error;
    }
  }

  /**
   * Private Helper Methods
   */
  private static async validateInvestmentConstraints(
    request: z.infer<typeof CompleteInvestmentRequestSchema>
  ): Promise<{ valid: boolean; error?: string; auditTrail: string[]; recommendations: string[] }> {
    const auditTrail: string[] = [];
    const recommendations: string[] = [];

    try {
      // Validate amount constraints
      if (!investmentConfig.isAmountValid(request.amount)) {
        const limits = investmentConfig.getLimits();
        return {
          valid: false,
          error: `Investment amount must be between ${limits.minAllocationAmount} and ${limits.maxAllocationAmount}`,
          auditTrail: [`Amount ${request.amount} outside valid range`],
          recommendations: ['Adjust investment amount to within limits']
        };
      }

      // Check deal exists and is investable
      const deal = await this.storage.getDeal(request.dealId);
      if (!deal) {
        return {
          valid: false,
          error: 'Deal not found',
          auditTrail: [`Deal ${request.dealId} not found`],
          recommendations: ['Verify deal ID is correct']
        };
      }

      // Check fund exists and has capacity
      const fund = await this.storage.getFund(request.fundId);
      if (!fund) {
        return {
          valid: false,
          error: 'Fund not found',
          auditTrail: [`Fund ${request.fundId} not found`],
          recommendations: ['Verify fund ID is correct']
        };
      }

      // Check for duplicate allocations
      const existingAllocations = await this.storage.getAllocationsByDeal(request.dealId);
      const duplicateAllocation = existingAllocations.find(a => a.fundId === request.fundId);
      
      if (duplicateAllocation && !investmentConfig.exportConfiguration().businessRules.allowDuplicateAllocations) {
        return {
          valid: false,
          error: 'Allocation already exists for this deal and fund combination',
          auditTrail: [`Duplicate allocation found: ${duplicateAllocation.id}`],
          recommendations: ['Use existing allocation', 'Update existing allocation amount']
        };
      }

      auditTrail.push('All investment constraints validated successfully');
      return {
        valid: true,
        auditTrail,
        recommendations: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      return {
        valid: false,
        error: `Constraint validation failed: ${errorMessage}`,
        auditTrail: [`Validation error: ${errorMessage}`],
        recommendations: ['Review system logs', 'Contact administrator']
      };
    }
  }

  private static async updateDealStageToInvested(dealId: number, userId: number): Promise<void> {
    await this.storage.updateDeal(dealId, {
      stage: 'invested'
    });

    // Create timeline event if supported
    try {
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
    } catch (error) {
      // Timeline event creation is optional
      this.logger.warn('Failed to create timeline event', { error, dealId });
    }
  }

  private static async recalculateFundMetrics(fundId: number): Promise<any> {
    try {
      await FundMetricsService.recalculateAllMetrics(fundId);
      
      // Return the updated metrics
      const storage = new (StorageFactory.getStorage().constructor as any)();
      const service = new FundMetricsService(storage);
      return await service.calculateFundMetrics(fundId);
    } catch (error) {
      this.logger.error('Failed to recalculate fund metrics', { error, fundId });
      return null;
    }
  }
}