import { DatabaseStorage } from '../server/database-storage';
import { FundMetricsService } from '../server/services/fund-metrics.service';

/**
 * Syncs fund metrics to reflect actual allocation status
 */
async function main() {
  const storage = new DatabaseStorage();
  const fundMetricsService = new FundMetricsService(storage);

  try {
    console.log('🔄 Syncing fund metrics with allocation reality...');
    await fundMetricsService.syncAllFundMetrics();
    console.log('✅ Fund metrics sync complete');
  } catch (error) {
    console.error('❌ Error syncing fund metrics:', error);
    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}