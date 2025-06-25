/**
 * Production Capital Calls Service
 * Unified service for all capital call operations with proper validation and error handling
 */

import { eq, and, sum, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { capitalCalls, fundAllocations } from '@shared/schema';
import type { CapitalCall, InsertCapitalCall } from '@shared/schema';
import { DatabaseTransaction } from './database/transaction.service';
import { AuditLogger } from './audit/audit-logger.service';
import { CacheManager } from './cache/cache-manager.service';

export interface CapitalCallCreationRequest {
  allocationId: number;
  callAmount: number;
  amountType?: "percentage" | "dollar";
  callDate: string | Date;
  dueDate: string | Date;
  status?: "scheduled" | "called" | "partially_paid" | "paid" | "defaulted" | "overdue";
  paidAmount?: number;
  paidDate?: string | Date;
  notes?: string;
  callPct?: number;
}

export interface CapitalCallOperationResult {
  success: boolean;
  capitalCall?: CapitalCall;
  error?: string;
  validationErrors?: string[];
  auditId?: string;
}

export interface OutstandingCalculation {
  callAmount: number;
  paidAmount: number;
  outstanding: number;
  isValid: boolean;
}

export class ProductionCapitalCallsService {
  private transaction = new DatabaseTransaction();
  private audit = new AuditLogger();
  private cache = new CacheManager();

  /**
   * Create capital call with comprehensive validation
   */
  async createCapitalCall(
    request: CapitalCallCreationRequest,
    userId: number
  ): Promise<CapitalCallOperationResult> {
    const auditId = await this.audit.startOperation('capital_call_creation', userId, request);

    try {
      // 1. Validate request
      const validation = this.validateCreationRequest(request);
      if (!validation.isValid) {
        await this.audit.logError(auditId, 'Validation failed', validation.errors);
        return {
          success: false,
          validationErrors: validation.errors
        };
      }

      // 2. Verify allocation exists
      const allocation = await this.getAllocation(request.allocationId);
      if (!allocation) {
        const error = `Allocation ${request.allocationId} not found`;
        await this.audit.logError(auditId, error);
        return {
          success: false,
          error
        };
      }

      // 3. Calculate outstanding amount
      const outstanding = this.calculateOutstanding(
        request.callAmount,
        request.paidAmount || 0
      );

      // 4. Create capital call in transaction
      const capitalCall = await this.transaction.execute(async (tx) => {
        const [created] = await tx
          .insert(capitalCalls)
          .values({
            allocationId: request.allocationId,
            callAmount: request.callAmount,
            amountType: request.amountType || 'dollar',
            callDate: new Date(request.callDate),
            dueDate: new Date(request.dueDate),
            status: request.status || 'scheduled',
            paidAmount: request.paidAmount || 0,
            paidDate: request.paidDate ? new Date(request.paidDate) : null,
            outstanding_amount: outstanding.outstanding.toString(),
            notes: request.notes || null,
            callPct: request.callPct || null
          })
          .returning();

        return created;
      });

      // 5. Update allocation status if needed
      await this.updateAllocationStatusFromCapitalCalls(request.allocationId);

      // 6. Invalidate caches
      await this.cache.invalidatePattern(`allocation:${request.allocationId}:*`);
      await this.cache.invalidatePattern(`fund:${allocation.fundId}:*`);

      await this.audit.logSuccess(auditId, 'Capital call created successfully', { 
        capitalCallId: capitalCall.id 
      });

      return {
        success: true,
        capitalCall,
        auditId
      };

    } catch (error) {
      await this.audit.logError(auditId, 'Capital call creation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Update capital call with validation
   */
  async updateCapitalCall(
    capitalCallId: number,
    updates: Partial<CapitalCall>,
    userId: number
  ): Promise<CapitalCallOperationResult> {
    const auditId = await this.audit.startOperation('capital_call_update', userId, { 
      capitalCallId, 
      updates 
    });

    try {
      // Get current capital call
      const current = await this.getCapitalCallById(capitalCallId);
      if (!current) {
        return {
          success: false,
          error: `Capital call ${capitalCallId} not found`
        };
      }

      // Validate status transition
      if (updates.status && updates.status !== current.status) {
        const transitionValid = this.validateStatusTransition(current.status, updates.status);
        if (!transitionValid) {
          return {
            success: false,
            error: `Invalid status transition from '${current.status}' to '${updates.status}'`
          };
        }
      }

      // Recalculate outstanding if amounts changed
      let finalUpdates = { ...updates };
      if (updates.callAmount !== undefined || updates.paidAmount !== undefined) {
        const newCallAmount = updates.callAmount ?? current.callAmount;
        const newPaidAmount = updates.paidAmount ?? (current.paidAmount || 0);
        const outstanding = this.calculateOutstanding(newCallAmount, newPaidAmount);
        finalUpdates.outstanding_amount = outstanding.outstanding.toString();
      }

      // Update in transaction
      const updated = await this.transaction.execute(async (tx) => {
        const [result] = await tx
          .update(capitalCalls)
          .set({
            ...finalUpdates,
            updatedAt: new Date()
          })
          .where(eq(capitalCalls.id, capitalCallId))
          .returning();

        return result;
      });

      // Update allocation status
      await this.updateAllocationStatusFromCapitalCalls(current.allocationId);

      // Invalidate caches
      await this.cache.invalidatePattern(`allocation:${current.allocationId}:*`);

      await this.audit.logSuccess(auditId, 'Capital call updated successfully');

      return {
        success: true,
        capitalCall: updated,
        auditId
      };

    } catch (error) {
      await this.audit.logError(auditId, 'Capital call update failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Process payment for capital call
   */
  async processPayment(
    capitalCallId: number,
    paymentAmount: number,
    paymentDate: Date,
    userId: number,
    notes?: string
  ): Promise<CapitalCallOperationResult> {
    const auditId = await this.audit.startOperation('capital_call_payment', userId, {
      capitalCallId,
      paymentAmount,
      paymentDate
    });

    try {
      const capitalCall = await this.getCapitalCallById(capitalCallId);
      if (!capitalCall) {
        return {
          success: false,
          error: `Capital call ${capitalCallId} not found`
        };
      }

      // Validate payment amount
      const currentPaid = capitalCall.paidAmount || 0;
      const totalPaid = currentPaid + paymentAmount;
      const outstanding = capitalCall.callAmount - totalPaid;

      if (paymentAmount <= 0) {
        return {
          success: false,
          error: 'Payment amount must be greater than zero'
        };
      }

      if (totalPaid > capitalCall.callAmount) {
        return {
          success: false,
          error: `Payment would exceed call amount. Outstanding: $${(capitalCall.callAmount - currentPaid).toLocaleString()}`
        };
      }

      // Determine new status
      let newStatus: string;
      if (outstanding <= 0.01) { // Allow for rounding
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        newStatus = capitalCall.status;
      }

      // Update capital call
      const updated = await this.transaction.execute(async (tx) => {
        const [result] = await tx
          .update(capitalCalls)
          .set({
            paidAmount: totalPaid,
            paidDate: paymentDate,
            outstanding_amount: Math.max(0, outstanding).toString(),
            status: newStatus,
            notes: notes ? `${capitalCall.notes || ''}\n${notes}`.trim() : capitalCall.notes,
            updatedAt: new Date()
          })
          .where(eq(capitalCalls.id, capitalCallId))
          .returning();

        return result;
      });

      // Log financial transaction
      await this.audit.logFinancialTransaction(
        'CAPITAL_CALL_PAYMENT',
        capitalCallId,
        userId,
        paymentAmount,
        'USD',
        {
          capitalCallId,
          allocationId: capitalCall.allocationId,
          totalPaid,
          outstanding: Math.max(0, outstanding)
        }
      );

      // Update allocation status
      await this.updateAllocationStatusFromCapitalCalls(capitalCall.allocationId);

      await this.audit.logSuccess(auditId, `Payment of $${paymentAmount.toLocaleString()} processed`);

      return {
        success: true,
        capitalCall: updated,
        auditId
      };

    } catch (error) {
      await this.audit.logError(auditId, 'Payment processing failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get capital calls for allocation with enhanced data
   */
  async getCapitalCallsForAllocation(allocationId: number): Promise<CapitalCall[]> {
    const cacheKey = `allocation:${allocationId}:capital_calls`;
    const cached = await this.cache.get<CapitalCall[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const calls = await db
      .select()
      .from(capitalCalls)
      .where(eq(capitalCalls.allocationId, allocationId))
      .orderBy(capitalCalls.callDate);

    await this.cache.set(cacheKey, calls, 300); // Cache for 5 minutes
    return calls;
  }

  /**
   * Get overdue capital calls
   */
  async getOverdueCapitalCalls(): Promise<CapitalCall[]> {
    const today = new Date();
    
    return await db
      .select()
      .from(capitalCalls)
      .where(
        and(
          lte(capitalCalls.dueDate, today),
          eq(capitalCalls.status, 'called') // Only called but not paid
        )
      )
      .orderBy(capitalCalls.dueDate);
  }

  /**
   * Calculate capital call metrics for fund - optimized for scale (1 to 1000+ allocations)
   */
  async calculateFundCapitalCallMetrics(fundId: number): Promise<{
    totalCalls: number;
    totalCallAmount: number;
    totalPaidAmount: number;
    totalOutstanding: number;
    overdueAmount: number;
    collectionRate: number;
  }> {
    // Single optimized query for all fund capital calls
    const metrics = await db.execute(`
      SELECT 
        COUNT(cc.id)::integer as total_calls,
        COALESCE(SUM(cc.call_amount), 0)::numeric as total_call_amount,
        COALESCE(SUM(cc.paid_amount), 0)::numeric as total_paid_amount,
        COALESCE(SUM(cc.outstanding_amount::numeric), 0)::numeric as total_outstanding,
        COALESCE(SUM(
          CASE 
            WHEN cc.due_date < CURRENT_DATE AND cc.status = 'called' 
            THEN cc.call_amount - COALESCE(cc.paid_amount, 0)
            ELSE 0 
          END
        ), 0)::numeric as overdue_amount
      FROM capital_calls cc
      JOIN fund_allocations fa ON cc.allocation_id = fa.id
      WHERE fa.fund_id = $1
    `, [fundId]);

    const result = metrics.rows[0];
    const totalCallAmount = parseFloat(result.total_call_amount || '0');
    const totalPaidAmount = parseFloat(result.total_paid_amount || '0');
    const collectionRate = totalCallAmount > 0 ? (totalPaidAmount / totalCallAmount) * 100 : 0;

    return {
      totalCalls: parseInt(result.total_calls || '0'),
      totalCallAmount,
      totalPaidAmount,
      totalOutstanding: parseFloat(result.total_outstanding || '0'),
      overdueAmount: parseFloat(result.overdue_amount || '0'),
      collectionRate: parseFloat(collectionRate.toFixed(2))
    };
  }

  /**
   * Private helper methods
   */
  private validateCreationRequest(request: CapitalCallCreationRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields
    if (!request.allocationId || !Number.isInteger(request.allocationId)) {
      errors.push('Valid allocation ID is required');
    }

    if (!request.callAmount || request.callAmount <= 0) {
      errors.push('Call amount must be greater than zero');
    }

    if (!request.callDate) {
      errors.push('Call date is required');
    }

    if (!request.dueDate) {
      errors.push('Due date is required');
    }

    // Date validation
    const callDate = new Date(request.callDate);
    const dueDate = new Date(request.dueDate);

    if (isNaN(callDate.getTime())) {
      errors.push('Invalid call date');
    }

    if (isNaN(dueDate.getTime())) {
      errors.push('Invalid due date');
    }

    if (callDate.getTime() && dueDate.getTime() && dueDate < callDate) {
      errors.push('Due date must be after call date');
    }

    // Amount validation
    if (request.paidAmount && request.paidAmount < 0) {
      errors.push('Paid amount cannot be negative');
    }

    if (request.paidAmount && request.paidAmount > request.callAmount) {
      errors.push('Paid amount cannot exceed call amount');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private calculateOutstanding(callAmount: number, paidAmount: number): OutstandingCalculation {
    const outstanding = Math.max(0, callAmount - paidAmount);
    
    return {
      callAmount,
      paidAmount,
      outstanding,
      isValid: paidAmount >= 0 && paidAmount <= callAmount
    };
  }

  private validateStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'scheduled': ['called', 'paid'],
      'called': ['partially_paid', 'paid', 'overdue', 'defaulted'],
      'partially_paid': ['paid', 'overdue', 'defaulted'],
      'paid': [], // Terminal state
      'overdue': ['partially_paid', 'paid', 'defaulted'],
      'defaulted': [] // Terminal state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  private async getAllocation(allocationId: number) {
    const [allocation] = await db
      .select()
      .from(fundAllocations)
      .where(eq(fundAllocations.id, allocationId))
      .limit(1);

    return allocation || null;
  }

  private async getCapitalCallById(id: number): Promise<CapitalCall | null> {
    const [capitalCall] = await db
      .select()
      .from(capitalCalls)
      .where(eq(capitalCalls.id, id))
      .limit(1);

    return capitalCall || null;
  }

  private async updateAllocationStatusFromCapitalCalls(allocationId: number): Promise<void> {
    // Get all capital calls for allocation
    const calls = await this.getCapitalCallsForAllocation(allocationId);
    const allocation = await this.getAllocation(allocationId);
    
    if (!allocation || calls.length === 0) {
      return;
    }

    // Calculate totals
    const totalCalled = calls.reduce((sum, call) => sum + call.callAmount, 0);
    const totalPaid = calls.reduce((sum, call) => sum + (call.paidAmount || 0), 0);

    // Determine allocation status
    let newStatus: string;
    if (totalPaid >= allocation.amount) {
      newStatus = 'funded';
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid';
    } else {
      newStatus = 'committed';
    }

    // Update allocation if status changed
    if (newStatus !== allocation.status) {
      await db
        .update(fundAllocations)
        .set({ 
          status: newStatus,
          paidAmount: totalPaid,
          calledAmount: totalCalled,
          updatedAt: new Date()
        })
        .where(eq(fundAllocations.id, allocationId));
    }
  }
}

export const productionCapitalCallsService = new ProductionCapitalCallsService();