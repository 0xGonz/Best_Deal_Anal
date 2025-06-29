/**
 * Background Job Monitoring Enhancement
 * 
 * Adds comprehensive monitoring to the job queue system
 * for visibility into background processing performance.
 */

import { InvestmentPlatformInstrumentation } from '../instrumentation/telemetry';
import { logger } from './structured-logger.service';
import { trace } from '@opentelemetry/api';

export interface JobMetrics {
  jobId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  retryCount?: number;
  error?: string;
}

export class JobMonitoringService {
  private jobMetrics = new Map<string, JobMetrics>();

  /**
   * Track job start
   */
  startJob(jobId: string, type: string, context?: Record<string, any>): void {
    const metrics: JobMetrics = {
      jobId,
      type,
      status: 'processing',
      startedAt: new Date(),
      retryCount: 0,
    };

    this.jobMetrics.set(jobId, metrics);

    // Update active jobs gauge
    InvestmentPlatformInstrumentation.activeJobsGauge.add(1, {
      job_type: type,
    });

    logger.info('Background job started', {
      operation: `job:${type}`,
    }, {
      jobId,
      jobType: type,
      ...context,
    });
  }

  /**
   * Track job completion
   */
  completeJob(jobId: string, result?: any): void {
    const metrics = this.jobMetrics.get(jobId);
    if (!metrics) return;

    metrics.status = 'completed';
    metrics.completedAt = new Date();
    metrics.duration = metrics.startedAt 
      ? metrics.completedAt.getTime() - metrics.startedAt.getTime()
      : undefined;

    // Update metrics
    this.updateJobMetrics(metrics);

    // Update active jobs gauge
    InvestmentPlatformInstrumentation.activeJobsGauge.add(-1, {
      job_type: metrics.type,
    });

    logger.info('Background job completed', {
      operation: `job:${metrics.type}`,
    }, {
      jobId,
      duration: metrics.duration,
      result: result ? 'success' : 'completed',
    });

    // Clean up after some time
    setTimeout(() => this.jobMetrics.delete(jobId), 60000);
  }

  /**
   * Track job failure
   */
  failJob(jobId: string, error: Error, willRetry: boolean = false): void {
    const metrics = this.jobMetrics.get(jobId);
    if (!metrics) return;

    if (willRetry) {
      metrics.retryCount = (metrics.retryCount || 0) + 1;
      logger.warn('Background job failed, retrying', {
        operation: `job:${metrics.type}`,
      }, {
        jobId,
        retryCount: metrics.retryCount,
        error: error.message,
      });
    } else {
      metrics.status = 'failed';
      metrics.completedAt = new Date();
      metrics.error = error.message;
      metrics.duration = metrics.startedAt 
        ? metrics.completedAt.getTime() - metrics.startedAt.getTime()
        : undefined;

      // Update active jobs gauge
      InvestmentPlatformInstrumentation.activeJobsGauge.add(-1, {
        job_type: metrics.type,
      });

      logger.error('Background job failed permanently', error, {
        operation: `job:${metrics.type}`,
      }, {
        jobId,
        duration: metrics.duration,
        retryCount: metrics.retryCount,
      });

      // Clean up after some time
      setTimeout(() => this.jobMetrics.delete(jobId), 300000); // Keep failed jobs longer
    }
  }

  /**
   * Get current job statistics
   */
  getJobStatistics(): {
    active: number;
    byType: Record<string, number>;
    avgDuration: Record<string, number>;
    failureRate: Record<string, number>;
  } {
    const stats = {
      active: 0,
      byType: {} as Record<string, number>,
      avgDuration: {} as Record<string, number>,
      failureRate: {} as Record<string, number>,
    };

    const completed = new Map<string, { total: number; failed: number; totalDuration: number }>();

    this.jobMetrics.forEach(metrics => {
      if (metrics.status === 'processing') {
        stats.active++;
      }

      // Track by type
      stats.byType[metrics.type] = (stats.byType[metrics.type] || 0) + 1;

      // Track completion stats
      if (metrics.status === 'completed' || metrics.status === 'failed') {
        if (!completed.has(metrics.type)) {
          completed.set(metrics.type, { total: 0, failed: 0, totalDuration: 0 });
        }

        const typeStats = completed.get(metrics.type)!;
        typeStats.total++;
        
        if (metrics.status === 'failed') {
          typeStats.failed++;
        }

        if (metrics.duration) {
          typeStats.totalDuration += metrics.duration;
        }
      }
    });

    // Calculate averages and failure rates
    completed.forEach((typeStats, type) => {
      stats.avgDuration[type] = typeStats.totalDuration / typeStats.total;
      stats.failureRate[type] = typeStats.failed / typeStats.total;
    });

    return stats;
  }

  private updateJobMetrics(metrics: JobMetrics): void {
    if (metrics.duration && metrics.type) {
      // Record job duration based on type
      switch (metrics.type) {
        case 'pdf-processing':
          InvestmentPlatformInstrumentation.pdfProcessingDuration.record(
            metrics.duration / 1000, // Convert to seconds
            { job_type: metrics.type }
          );
          break;
        case 'allocation-creation':
          InvestmentPlatformInstrumentation.allocationCreationDuration.record(
            metrics.duration / 1000,
            { job_type: metrics.type }
          );
          break;
      }
    }
  }
}

export const jobMonitor = new JobMonitoringService();
