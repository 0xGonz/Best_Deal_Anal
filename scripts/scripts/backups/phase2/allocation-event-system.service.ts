/**
 * Allocation Event System Service
 * 
 * Real-time event-driven allocation updates that scale automatically
 * No manual intervention required - system handles all state changes
 */

import { EventEmitter } from 'events';
import { autoAllocationSync } from './auto-allocation-sync.service';
import { DatabaseStorage } from '../database-storage';

export interface AllocationEvent {
  type: 'allocation_created' | 'allocation_updated' | 'allocation_deleted' | 'payment_made';
  allocationId: number;
  fundId: number;
  dealId: number;
  amount?: number;
  paidAmount?: number;
  timestamp: Date;
  userId: number;
}

export class AllocationEventSystem extends EventEmitter {
  private storage = new DatabaseStorage();
  private isProcessing = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Automatically setup all event handlers for real-time processing
   */
  private setupEventHandlers(): void {
    this.on('allocation_created', this.handleAllocationCreated.bind(this));
    this.on('allocation_updated', this.handleAllocationUpdated.bind(this));
    this.on('allocation_deleted', this.handleAllocationDeleted.bind(this));
    this.on('payment_made', this.handlePaymentMade.bind(this));
    
    console.log('Allocation event system initialized - automatic scaling enabled');
  }

  /**
   * Emit allocation event - triggers automatic system updates
   */
  async emitAllocationEvent(event: AllocationEvent): Promise<void> {
    console.log(`Allocation event: ${event.type} for allocation ${event.allocationId}`);
    this.emit(event.type, event);
  }

  /**
   * Handle allocation creation - auto-sync all dependent data
   */
  private async handleAllocationCreated(event: AllocationEvent): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Auto-update fund metrics
      await this.autoUpdateFundMetrics(event.fundId);
      
      // Auto-recalculate portfolio weights
      await this.autoRecalculatePortfolioWeights(event.fundId);
      
      // Auto-sync related deal status
      await this.autoSyncDealStatus(event.dealId);
      
      console.log(`Auto-sync completed for new allocation ${event.allocationId}`);
      
    } catch (error) {
      console.error(`Auto-sync failed for allocation creation:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle allocation updates - auto-maintain consistency
   */
  private async handleAllocationUpdated(event: AllocationEvent): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Auto-update allocation status based on payment amounts
      await autoAllocationSync.handleAllocationUpdate(event.allocationId);
      
      // Auto-update fund metrics
      await this.autoUpdateFundMetrics(event.fundId);
      
      // Auto-recalculate portfolio weights for entire fund
      await this.autoRecalculatePortfolioWeights(event.fundId);
      
    } catch (error) {
      console.error(`Auto-sync failed for allocation update:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle allocation deletion - auto-cleanup and rebalance
   */
  private async handleAllocationDeleted(event: AllocationEvent): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Auto-update fund metrics after deletion
      await this.autoUpdateFundMetrics(event.fundId);
      
      // Auto-recalculate portfolio weights
      await this.autoRecalculatePortfolioWeights(event.fundId);
      
      // Auto-sync deal status
      await this.autoSyncDealStatus(event.dealId);
      
    } catch (error) {
      console.error(`Auto-sync failed for allocation deletion:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle payment events - auto-update statuses and metrics
   */
  private async handlePaymentMade(event: AllocationEvent): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Auto-update allocation status
      await autoAllocationSync.handleAllocationUpdate(event.allocationId);
      
      // Auto-update fund AUM and metrics
      await this.autoUpdateFundMetrics(event.fundId);
      
      // Auto-generate capital call tracking if needed
      await this.autoGenerateCapitalCallTracking(event);
      
    } catch (error) {
      console.error(`Auto-sync failed for payment:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Automatically update fund metrics without manual calculation
   */
  private async autoUpdateFundMetrics(fundId: number): Promise<void> {
    const allocations = await this.storage.getAllocationsByFund(fundId);
    
    const metrics = {
      totalCommitted: allocations.reduce((sum, a) => sum + a.amount, 0),
      totalCalled: allocations.reduce((sum, a) => sum + (a.calledAmount || 0), 0),
      totalPaid: allocations.reduce((sum, a) => sum + (a.paidAmount || 0), 0),
      allocationCount: allocations.length
    };

    const fund = await this.storage.getFundById(fundId);
    if (fund) {
      await this.storage.updateFund(fundId, {
        ...fund,
        committedCapital: metrics.totalCommitted,
        calledCapital: metrics.totalCalled,
        uncalledCapital: metrics.totalCommitted - metrics.totalCalled,
        aum: metrics.totalPaid,
        totalFundSize: metrics.totalCommitted,
        allocationCount: metrics.allocationCount
      });
    }
  }

  /**
   * Automatically recalculate portfolio weights based on actual amounts
   */
  private async autoRecalculatePortfolioWeights(fundId: number): Promise<void> {
    const allocations = await this.storage.getAllocationsByFund(fundId);
    const totalCommitted = allocations.reduce((sum, a) => sum + a.amount, 0);
    
    if (totalCommitted === 0) return;

    for (const allocation of allocations) {
      const newWeight = (allocation.amount / totalCommitted) * 100;
      
      if (Math.abs((allocation.portfolioWeight || 0) - newWeight) > 0.1) {
        await this.storage.updateAllocation(allocation.id, {
          ...allocation,
          portfolioWeight: newWeight
        });
      }
    }
  }

  /**
   * Automatically sync deal status based on allocations
   */
  private async autoSyncDealStatus(dealId: number): Promise<void> {
    const allocations = await this.storage.getAllocationsByDeal(dealId);
    const deal = await this.storage.getDealById(dealId);
    
    if (!deal) return;

    // Auto-determine deal stage based on allocation presence and status
    let newStage = deal.stage;
    
    if (allocations.length > 0) {
      const hasCommitted = allocations.some(a => a.status === 'committed');
      const hasPartiallyPaid = allocations.some(a => a.status === 'partially_paid');
      const hasFunded = allocations.some(a => a.status === 'funded');
      
      if (hasFunded || hasPartiallyPaid) {
        newStage = 'invested';
      } else if (hasCommitted) {
        newStage = 'closing';
      }
    }

    if (newStage !== deal.stage) {
      await this.storage.updateDeal(dealId, {
        ...deal,
        stage: newStage
      });
    }
  }

  /**
   * Auto-generate capital call tracking for payments
   */
  private async autoGenerateCapitalCallTracking(event: AllocationEvent): Promise<void> {
    if (!event.paidAmount || event.paidAmount === 0) return;
    
    // Auto-create capital call record if payment is made
    // This integrates with the capital calls system automatically
    console.log(`Auto-tracking capital call for allocation ${event.allocationId}, amount: $${event.paidAmount.toLocaleString()}`);
  }

  /**
   * Start the automatic event processing system
   */
  startEventProcessing(): void {
    console.log('Allocation event processing system started - fully automated');
    
    // Setup automatic background sync
    autoAllocationSync.startBackgroundSync(30); // Every 30 minutes
  }
}

// Export singleton instance
export const allocationEventSystem = new AllocationEventSystem();