import { DatabaseStorage } from '../database-storage';

/**
 * FundMetricsService
 * 
 * Provides accurate, real-time calculation of fund metrics based on 
 * allocation statuses. Ensures called/uncalled capital always reflects 
 * actual allocation states.
 */
export class FundMetricsService {
  private storage: DatabaseStorage;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  /**
   * Calculates real-time fund metrics from allocations
   */
  async calculateFundMetrics(fundId: number) {
    const allocations = await this.storage.getAllocationsByFund(fundId);
    
    const metrics = {
      totalCommittedCapital: 0,
      calledCapital: 0,
      uncalledCapital: 0,
      allocationCount: allocations.length
    };

    for (const allocation of allocations) {
      const amount = Number(allocation.amount) || 0;
      metrics.totalCommittedCapital += amount;

      // Calculate called capital based on status
      if (allocation.status === 'funded') {
        // Fully funded = fully called
        metrics.calledCapital += amount;
      } else if (allocation.status === 'partially_paid') {
        // Use paidAmount if available, otherwise treat as called
        const paidAmount = Number(allocation.paidAmount) || amount;
        metrics.calledCapital += paidAmount;
      }
      // 'committed' status = not called yet
    }

    metrics.uncalledCapital = metrics.totalCommittedCapital - metrics.calledCapital;

    return metrics;
  }

  /**
   * Updates fund metrics in the database to match allocation reality
   */
  async syncFundMetrics(fundId: number) {
    const metrics = await this.calculateFundMetrics(fundId);
    
    // Update the fund record with calculated metrics
    await this.storage.updateFund(fundId, {
      committedCapital: metrics.totalCommittedCapital,
      calledCapital: metrics.calledCapital,
      uncalledCapital: metrics.uncalledCapital,
      allocationCount: metrics.allocationCount,
      totalFundSize: metrics.totalCommittedCapital // Keep these in sync
    });

    console.log(`📊 Synced metrics for fund ${fundId}:`, {
      committed: `$${metrics.totalCommittedCapital.toLocaleString()}`,
      called: `$${metrics.calledCapital.toLocaleString()}`,
      uncalled: `$${metrics.uncalledCapital.toLocaleString()}`,
      allocations: metrics.allocationCount
    });

    return metrics;
  }

  /**
   * Ensures all funds have accurate metrics
   */
  async syncAllFundMetrics() {
    const funds = await this.storage.getFunds();
    
    for (const fund of funds) {
      await this.syncFundMetrics(fund.id);
    }

    console.log(`✅ Synced metrics for ${funds.length} funds`);
  }
}