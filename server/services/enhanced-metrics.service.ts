/**
 * Enhanced Metrics Service
 * 
 * Extends the basic performance monitor with business-specific metrics
 * and more detailed system monitoring as identified in the audit.
 */

import { InvestmentPlatformInstrumentation } from '../instrumentation/telemetry';
import { DatabaseStorage } from '../storage';

export interface BusinessMetrics {
  allocations: {
    total: number;
    byStatus: Record<string, number>;
    byFund: Record<string, number>;
    averageAmount: number;
    totalValue: number;
  };
  capitalCalls: {
    total: number;
    outstanding: number;
    totalCalled: number;
    averageCallSize: number;
  };
  documents: {
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    processingQueue: number;
  };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
    dbConnectionPoolUtilization: number;
  };
}

export class EnhancedMetricsService {
  private storage: DatabaseStorage;
  private metrics: BusinessMetrics;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
    this.metrics = this.initializeMetrics();
  }

  async collectBusinessMetrics(): Promise<BusinessMetrics> {
    console.log('📊 Collecting enhanced business metrics...');

    try {
      // Allocation metrics
      const allocations = await this.storage.getAllFundAllocations();
      this.metrics.allocations = {
        total: allocations.length,
        byStatus: this.groupBy(allocations, 'status'),
        byFund: this.groupBy(allocations, 'fundId'),
        averageAmount: allocations.reduce((sum, a) => sum + a.amount, 0) / allocations.length || 0,
        totalValue: allocations.reduce((sum, a) => sum + a.amount, 0),
      };

      // Capital call metrics
      const capitalCalls = await this.storage.getCapitalCalls();
      this.metrics.capitalCalls = {
        total: capitalCalls.length,
        outstanding: capitalCalls.filter(cc => cc.status === 'called').length,
        totalCalled: capitalCalls.reduce((sum, cc) => sum + cc.amount, 0),
        averageCallSize: capitalCalls.reduce((sum, cc) => sum + cc.amount, 0) / capitalCalls.length || 0,
      };

      // Document metrics
      const documents = await this.storage.getDocuments();
      this.metrics.documents = {
        total: documents.length,
        byType: this.groupBy(documents, 'file_name', (name: string) => {
          const ext = name.split('.').pop()?.toLowerCase() || 'unknown';
          return ext === 'pdf' ? 'pdf' : ext === 'csv' ? 'csv' : 'other';
        }),
        totalSize: documents.reduce((sum, d) => sum + (d.file_size || 0), 0),
        processingQueue: 0, // TODO: Connect to job queue metrics
      };

      // Update OpenTelemetry metrics
      this.updateTelemetryMetrics();

      return this.metrics;
    } catch (error) {
      console.error('Failed to collect business metrics:', error);
      return this.metrics;
    }
  }

  private updateTelemetryMetrics(): void {
    // Update gauges with current values
    InvestmentPlatformInstrumentation.activeJobsGauge.add(
      this.metrics.documents.processingQueue
    );
  }

  private groupBy<T>(
    array: T[], 
    key: keyof T,
    transform?: (value: any) => string
  ): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = transform ? transform(item[key]) : String(item[key]);
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private initializeMetrics(): BusinessMetrics {
    return {
      allocations: {
        total: 0,
        byStatus: {},
        byFund: {},
        averageAmount: 0,
        totalValue: 0,
      },
      capitalCalls: {
        total: 0,
        outstanding: 0,
        totalCalled: 0,
        averageCallSize: 0,
      },
      documents: {
        total: 0,
        byType: {},
        totalSize: 0,
        processingQueue: 0,
      },
      performance: {
        avgResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        dbConnectionPoolUtilization: 0,
      },
    };
  }

  /**
   * Expose metrics in Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    await this.collectBusinessMetrics();
    
    let output = '';
    
    // Allocation metrics
    output += `# HELP investment_allocations_total Total number of allocations\n`;
    output += `# TYPE investment_allocations_total gauge\n`;
    output += `investment_allocations_total ${this.metrics.allocations.total}\n`;
    
    output += `# HELP investment_allocation_value_total Total value of all allocations\n`;
    output += `# TYPE investment_allocation_value_total gauge\n`;
    output += `investment_allocation_value_total ${this.metrics.allocations.totalValue}\n`;
    
    // Capital call metrics
    output += `# HELP investment_capital_calls_outstanding Outstanding capital calls\n`;
    output += `# TYPE investment_capital_calls_outstanding gauge\n`;
    output += `investment_capital_calls_outstanding ${this.metrics.capitalCalls.outstanding}\n`;
    
    // Document metrics
    output += `# HELP investment_documents_total Total number of documents\n`;
    output += `# TYPE investment_documents_total gauge\n`;
    output += `investment_documents_total ${this.metrics.documents.total}\n`;
    
    return output;
  }
}
