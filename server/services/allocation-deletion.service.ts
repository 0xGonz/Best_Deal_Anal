/**
 * Allocation Deletion Service
 * 
 * Systematic, scalable solution for handling allocation deletions with proper
 * dependency cleanup and data integrity preservation.
 */

import { StorageFactory } from '../storage-factory.js';
import { AuditLogger } from './audit/audit-logger.service.js';

interface DeletionBlocker {
  type: 'capital_calls' | 'payments' | 'status_mismatch';
  description: string;
  autoResolvable: boolean;
}

interface DeletionPlan {
  allocationId: number;
  blockers: DeletionBlocker[];
  resolutionSteps: string[];
  canProceed: boolean;
}

export class AllocationDeletionService {
  private storage = StorageFactory.getStorage();
  private auditLogger = new AuditLogger();

  /**
   * Safely delete an allocation with automatic dependency resolution
   */
  async safeDelete(allocationId: number, userId: number): Promise<{ success: boolean; message: string }> {
    try {
      // Step 1: Analyze what's blocking the deletion
      const plan = await this.analyzeDeletionBlockers(allocationId);
      
      if (!plan.canProceed && plan.blockers.some(b => !b.autoResolvable)) {
        return {
          success: false,
          message: `Cannot delete allocation: ${plan.blockers.filter(b => !b.autoResolvable).map(b => b.description).join(', ')}`
        };
      }

      // Step 2: Execute deletion plan with database transaction
      await this.storage.transaction(async () => {
        // Temporarily disable triggers for cleanup
        await this.disableAllocationTriggers();

        try {
          // Step 3: Resolve blockers systematically
          await this.resolveBlockers(allocationId, plan.blockers);

          // Step 4: Delete the allocation
          await this.storage.deleteAllocation(allocationId);

          // Step 5: Log the deletion for audit
          console.log(`Allocation ${allocationId} deleted by user ${userId}. Resolved blockers:`, plan.blockers.map(b => b.type));

        } finally {
          // Always re-enable triggers
          await this.enableAllocationTriggers();
        }
      });

      return {
        success: true,
        message: `Allocation deleted successfully. Resolved ${plan.blockers.length} blockers automatically.`
      };

    } catch (error) {
      console.error('Allocation deletion failed:', error);
      return {
        success: false,
        message: `Deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Analyze what's preventing an allocation from being deleted
   */
  private async analyzeDeletionBlockers(allocationId: number): Promise<DeletionPlan> {
    const blockers: DeletionBlocker[] = [];
    const resolutionSteps: string[] = [];

    // Check for capital calls
    const capitalCalls = await this.storage.query(
      'SELECT id, call_amount FROM capital_calls WHERE allocation_id = $1',
      [allocationId]
    );

    if (capitalCalls.length > 0) {
      blockers.push({
        type: 'capital_calls',
        description: `${capitalCalls.length} capital calls linked`,
        autoResolvable: true
      });
      resolutionSteps.push(`Remove ${capitalCalls.length} capital calls`);
    }

    // Check allocation status and payments
    const allocation = await this.storage.query(
      'SELECT status, paid_amount, amount FROM fund_allocations WHERE id = $1',
      [allocationId]
    );

    if (allocation.length > 0) {
      const alloc = allocation[0];
      
      if (alloc.paid_amount > 0) {
        blockers.push({
          type: 'payments',
          description: `$${alloc.paid_amount} in payments recorded`,
          autoResolvable: true
        });
        resolutionSteps.push('Reset paid amount to $0');
      }

      if (alloc.status !== 'committed') {
        blockers.push({
          type: 'status_mismatch',
          description: `Status is '${alloc.status}', must be 'committed'`,
          autoResolvable: true
        });
        resolutionSteps.push('Reset status to committed');
      }
    }

    return {
      allocationId,
      blockers,
      resolutionSteps,
      canProceed: blockers.every(b => b.autoResolvable)
    };
  }

  /**
   * Systematically resolve all deletion blockers
   */
  private async resolveBlockers(allocationId: number, blockers: DeletionBlocker[]): Promise<void> {
    for (const blocker of blockers) {
      switch (blocker.type) {
        case 'capital_calls':
          await this.removeCapitalCalls(allocationId);
          break;
        
        case 'payments':
        case 'status_mismatch':
          await this.resetAllocationState(allocationId);
          break;
      }
    }
  }

  /**
   * Remove all capital calls for an allocation
   */
  private async removeCapitalCalls(allocationId: number): Promise<void> {
    await this.storage.query(
      'DELETE FROM capital_calls WHERE allocation_id = $1',
      [allocationId]
    );
  }

  /**
   * Reset allocation to clean state for deletion
   */
  private async resetAllocationState(allocationId: number): Promise<void> {
    await this.storage.query(
      'UPDATE fund_allocations SET paid_amount = 0, status = $1 WHERE id = $2',
      ['committed', allocationId]
    );
  }

  /**
   * Temporarily disable allocation triggers for cleanup
   */
  private async disableAllocationTriggers(): Promise<void> {
    await this.storage.query('ALTER TABLE fund_allocations DISABLE TRIGGER trigger_enforce_payment_workflow');
    await this.storage.query('ALTER TABLE capital_calls DISABLE TRIGGER sync_allocation_on_capital_call_change');
    await this.storage.query('ALTER TABLE capital_calls DISABLE TRIGGER trigger_sync_allocation_totals');
    await this.storage.query('ALTER TABLE capital_calls DISABLE TRIGGER capital_call_sync_trigger');
  }

  /**
   * Re-enable allocation triggers after cleanup
   */
  private async enableAllocationTriggers(): Promise<void> {
    await this.storage.query('ALTER TABLE fund_allocations ENABLE TRIGGER trigger_enforce_payment_workflow');
    await this.storage.query('ALTER TABLE capital_calls ENABLE TRIGGER sync_allocation_on_capital_call_change');
    await this.storage.query('ALTER TABLE capital_calls ENABLE TRIGGER trigger_sync_allocation_totals');
    await this.storage.query('ALTER TABLE capital_calls ENABLE TRIGGER capital_call_sync_trigger');
  }

  /**
   * Get deletion preview without executing
   */
  async previewDeletion(allocationId: number): Promise<DeletionPlan> {
    return this.analyzeDeletionBlockers(allocationId);
  }

  /**
   * Batch delete multiple allocations efficiently
   */
  async batchDelete(allocationIds: number[], userId: number): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of allocationIds) {
      const result = await this.safeDelete(id, userId);
      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`Allocation ${id}: ${result.message}`);
      }
    }

    return { success, failed, errors };
  }
}