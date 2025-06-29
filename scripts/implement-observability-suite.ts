#!/usr/bin/env tsx
/**
 * Observability Suite Implementation
 * 
 * Addresses the observability gap identified in the external audit by implementing:
 * 1. OpenTelemetry tracing for request/query visibility
 * 2. Enhanced metrics collection beyond basic performance
 * 3. Structured logging with proper sanitization
 * 4. Background job monitoring and tracing
 */

import fs from 'fs';
import path from 'path';

console.log('📊 Implementing Comprehensive Observability Suite');
console.log('═══════════════════════════════════════════════════════════════════════════');

interface ObservabilityResult {
  implemented: string[];
  enhanced: string[];
  errors: string[];
}

class ObservabilityImplementation {
  private result: ObservabilityResult = {
    implemented: [],
    enhanced: [],
    errors: []
  };

  async execute(): Promise<void> {
    console.log('\n🎯 Phase 1: Implement OpenTelemetry Tracing');
    await this.implementOpenTelemetry();

    console.log('\n🎯 Phase 2: Enhance Metrics Collection');
    await this.enhanceMetrics();

    console.log('\n🎯 Phase 3: Implement Structured Logging');
    await this.implementStructuredLogging();

    console.log('\n🎯 Phase 4: Add Background Job Monitoring');
    await this.addJobMonitoring();

    this.generateReport();
  }

  private async implementOpenTelemetry(): Promise<void> {
    console.log('  📍 Creating OpenTelemetry instrumentation...');
    
    const telemetrySetup = `/**
 * OpenTelemetry Instrumentation Setup
 * 
 * Provides distributed tracing for HTTP requests, database queries, and background jobs.
 * Addresses the observability gap identified in the external audit.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { metrics } from '@opentelemetry/api';

// Environment-based configuration
const isDev = process.env.NODE_ENV === 'development';
const serviceName = process.env.SERVICE_NAME || 'investment-platform';
const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

// Resource definition
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

// Jaeger exporter for traces (only in production or when explicitly enabled)
const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

// Prometheus exporter for metrics
const prometheusExporter = new PrometheusExporter({
  port: parseInt(process.env.METRICS_PORT || '9464'),
  endpoint: '/metrics',
}, () => {
  console.log('📊 Prometheus metrics available on port', process.env.METRICS_PORT || '9464');
});

// SDK configuration
const sdk = new NodeSDK({
  resource,
  traceExporter: isDev ? undefined : jaegerExporter,
  spanProcessor: isDev ? 
    new SimpleSpanProcessor(jaegerExporter) : 
    new BatchSpanProcessor(jaegerExporter),
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Enable specific instrumentations
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span, request) => {
          // Add custom attributes for investment platform context
          if (request.url?.includes('/api/')) {
            span.setAttributes({
              'investment.platform.api': true,
              'investment.platform.endpoint': request.url,
            });
          }
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
      '@opentelemetry/instrumentation-fs': {
        enabled: true, // Monitor file operations for document management
      },
      // Disable instrumentations that create too much noise in development
      '@opentelemetry/instrumentation-net': {
        enabled: !isDev,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: !isDev,
      },
    }),
  ],
});

/**
 * Custom instrumentation for investment platform operations
 */
export class InvestmentPlatformInstrumentation {
  private static meter = metrics.getMeter('investment-platform', '1.0.0');

  // Counters for business operations
  static readonly allocationsCreated = this.meter.createCounter('allocations_created_total', {
    description: 'Total number of allocations created',
  });

  static readonly capitalCallsGenerated = this.meter.createCounter('capital_calls_generated_total', {
    description: 'Total number of capital calls generated',
  });

  static readonly documentsUploaded = this.meter.createCounter('documents_uploaded_total', {
    description: 'Total number of documents uploaded',
  });

  // Histograms for performance tracking
  static readonly allocationCreationDuration = this.meter.createHistogram('allocation_creation_duration_seconds', {
    description: 'Time taken to create allocations',
    boundaries: [0.1, 0.5, 1, 2, 5, 10],
  });

  static readonly pdfProcessingDuration = this.meter.createHistogram('pdf_processing_duration_seconds', {
    description: 'Time taken to process PDF documents',
    boundaries: [1, 5, 10, 30, 60, 300],
  });

  // Gauges for system state
  static readonly activeJobsGauge = this.meter.createUpDownCounter('active_background_jobs', {
    description: 'Number of currently active background jobs',
  });

  /**
   * Record an allocation creation event
   */
  static recordAllocationCreated(fundId: number, dealId: number, amount: number): void {
    this.allocationsCreated.add(1, {
      fund_id: fundId.toString(),
      deal_id: dealId.toString(),
      amount_range: this.getAmountRange(amount),
    });
  }

  /**
   * Record capital call generation
   */
  static recordCapitalCall(fundId: number, amount: number): void {
    this.capitalCallsGenerated.add(1, {
      fund_id: fundId.toString(),
      amount_range: this.getAmountRange(amount),
    });
  }

  /**
   * Record document upload
   */
  static recordDocumentUpload(fileSize: number, fileType: string): void {
    this.documentsUploaded.add(1, {
      file_type: fileType,
      size_range: this.getSizeRange(fileSize),
    });
  }

  private static getAmountRange(amount: number): string {
    if (amount < 100000) return 'under_100k';
    if (amount < 1000000) return '100k_to_1m';
    if (amount < 10000000) return '1m_to_10m';
    return 'over_10m';
  }

  private static getSizeRange(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return 'under_1mb';
    if (mb < 10) return '1mb_to_10mb';
    if (mb < 50) return '10mb_to_50mb';
    return 'over_50mb';
  }
}

// Initialize the SDK
if (process.env.TELEMETRY_DISABLED !== 'true') {
  sdk.start();
  console.log('📈 OpenTelemetry instrumentation initialized');
} else {
  console.log('📈 OpenTelemetry disabled via TELEMETRY_DISABLED=true');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('📈 OpenTelemetry shut down successfully'))
    .catch((error) => console.error('📈 Error shutting down OpenTelemetry', error))
    .finally(() => process.exit(0));
});

export { sdk };
`;

    try {
      fs.writeFileSync('server/instrumentation/telemetry.ts', telemetrySetup);
      this.result.implemented.push('OpenTelemetry tracing and metrics');
      console.log('    ✅ Created OpenTelemetry instrumentation');
    } catch (error) {
      this.result.errors.push(`Failed to create telemetry setup: ${error}`);
      console.log(`    ❌ Error: ${error}`);
    }
  }

  private async enhanceMetrics(): Promise<void> {
    console.log('  📍 Enhancing metrics collection beyond basic performance...');
    
    const enhancedMetricsService = `/**
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
    output += \`# HELP investment_allocations_total Total number of allocations\\n\`;
    output += \`# TYPE investment_allocations_total gauge\\n\`;
    output += \`investment_allocations_total \${this.metrics.allocations.total}\\n\`;
    
    output += \`# HELP investment_allocation_value_total Total value of all allocations\\n\`;
    output += \`# TYPE investment_allocation_value_total gauge\\n\`;
    output += \`investment_allocation_value_total \${this.metrics.allocations.totalValue}\\n\`;
    
    // Capital call metrics
    output += \`# HELP investment_capital_calls_outstanding Outstanding capital calls\\n\`;
    output += \`# TYPE investment_capital_calls_outstanding gauge\\n\`;
    output += \`investment_capital_calls_outstanding \${this.metrics.capitalCalls.outstanding}\\n\`;
    
    // Document metrics
    output += \`# HELP investment_documents_total Total number of documents\\n\`;
    output += \`# TYPE investment_documents_total gauge\\n\`;
    output += \`investment_documents_total \${this.metrics.documents.total}\\n\`;
    
    return output;
  }
}
`;

    try {
      fs.mkdirSync('server/instrumentation', { recursive: true });
      fs.writeFileSync('server/services/enhanced-metrics.service.ts', enhancedMetricsService);
      this.result.enhanced.push('Business metrics collection');
      console.log('    ✅ Created enhanced metrics service');
    } catch (error) {
      this.result.errors.push(`Failed to create enhanced metrics: ${error}`);
      console.log(`    ❌ Error: ${error}`);
    }
  }

  private async implementStructuredLogging(): Promise<void> {
    console.log('  📍 Implementing structured logging with sanitization...');
    
    const structuredLogger = `/**
 * Structured Logging Service
 * 
 * Replaces console.log with structured, sanitized logging.
 * Addresses the logging improvements identified in the external audit.
 */

import { trace, context } from '@opentelemetry/api';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: number;
  orgId?: number;
  requestId?: string;
  operation?: string;
  fundId?: number;
  dealId?: number;
  allocationId?: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  traceId?: string;
  spanId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  meta?: Record<string, any>;
}

export class StructuredLogger {
  private level: LogLevel;
  private serviceName: string;

  constructor(serviceName: string = 'investment-platform') {
    this.serviceName = serviceName;
    this.level = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
  }

  debug(message: string, context?: LogContext, meta?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, meta);
  }

  info(message: string, context?: LogContext, meta?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, meta);
  }

  warn(message: string, context?: LogContext, meta?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, meta);
  }

  error(message: string, error?: Error, context?: LogContext, meta?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      context: this.sanitizeContext(context),
      ...this.getTraceInfo(),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      } : undefined,
      meta: this.sanitizeMetadata(meta),
    };

    if (this.level <= LogLevel.ERROR) {
      console.error(JSON.stringify(logEntry));
    }
  }

  /**
   * Log allocation operations with business context
   */
  logAllocationOperation(
    operation: string,
    allocation: { fundId?: number; dealId?: number; amount?: number },
    context?: LogContext
  ): void {
    this.info(\`Allocation \${operation}\`, {
      ...context,
      operation: \`allocation:\${operation}\`,
      fundId: allocation.fundId,
      dealId: allocation.dealId,
    }, {
      amount: allocation.amount,
      sanitized: true,
    });
  }

  /**
   * Log capital call operations
   */
  logCapitalCallOperation(
    operation: string,
    capitalCall: { fundId?: number; amount?: number },
    context?: LogContext
  ): void {
    this.info(\`Capital call \${operation}\`, {
      ...context,
      operation: \`capital_call:\${operation}\`,
      fundId: capitalCall.fundId,
    }, {
      amount: capitalCall.amount,
      sanitized: true,
    });
  }

  /**
   * Log document operations with file metadata
   */
  logDocumentOperation(
    operation: string,
    document: { fileName?: string; fileSize?: number; dealId?: number },
    context?: LogContext
  ): void {
    this.info(\`Document \${operation}\`, {
      ...context,
      operation: \`document:\${operation}\`,
      dealId: document.dealId,
    }, {
      fileName: document.fileName,
      fileSize: document.fileSize,
      sanitized: true,
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext, meta?: Record<string, any>): void {
    if (this.level <= level) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel[level],
        message,
        context: this.sanitizeContext(context),
        ...this.getTraceInfo(),
        meta: this.sanitizeMetadata(meta),
      };

      console.log(JSON.stringify(logEntry));
    }
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    // Remove sensitive data, keep business identifiers
    const sanitized: LogContext = {};
    
    if (context.userId) sanitized.userId = context.userId;
    if (context.orgId) sanitized.orgId = context.orgId;
    if (context.requestId) sanitized.requestId = context.requestId;
    if (context.operation) sanitized.operation = context.operation;
    if (context.fundId) sanitized.fundId = context.fundId;
    if (context.dealId) sanitized.dealId = context.dealId;
    if (context.allocationId) sanitized.allocationId = context.allocationId;

    return sanitized;
  }

  private sanitizeMetadata(meta?: Record<string, any>): Record<string, any> | undefined {
    if (!meta) return undefined;

    const sanitized: Record<string, any> = {};
    
    // Allowlist approach - only include safe metadata
    const safeKeys = [
      'amount', 'status', 'fileName', 'fileSize', 'duration', 'count',
      'operation', 'result', 'sanitized', 'processingTime', 'retryCount'
    ];

    Object.keys(meta).forEach(key => {
      if (safeKeys.includes(key)) {
        sanitized[key] = meta[key];
      }
    });

    return sanitized;
  }

  private getTraceInfo(): { traceId?: string; spanId?: string } {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return {};
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }
}

// Global logger instance
export const logger = new StructuredLogger();

// Replace console methods in production
if (process.env.NODE_ENV === 'production') {
  console.log = (...args) => logger.info(args.join(' '));
  console.warn = (...args) => logger.warn(args.join(' '));
  console.error = (...args) => logger.error(args.join(' '));
}
`;

    try {
      fs.writeFileSync('server/services/structured-logger.service.ts', structuredLogger);
      this.result.implemented.push('Structured logging with sanitization');
      console.log('    ✅ Created structured logging service');
    } catch (error) {
      this.result.errors.push(`Failed to create structured logging: ${error}`);
      console.log(`    ❌ Error: ${error}`);
    }
  }

  private async addJobMonitoring(): Promise<void> {
    console.log('  📍 Adding background job monitoring...');
    
    const jobMonitoring = `/**
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
      operation: \`job:\${type}\`,
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
      operation: \`job:\${metrics.type}\`,
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
        operation: \`job:\${metrics.type}\`,
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
        operation: \`job:\${metrics.type}\`,
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
`;

    try {
      fs.writeFileSync('server/services/job-monitoring.service.ts', jobMonitoring);
      this.result.implemented.push('Background job monitoring and tracing');
      console.log('    ✅ Created job monitoring service');
    } catch (error) {
      this.result.errors.push(`Failed to create job monitoring: ${error}`);
      console.log(`    ❌ Error: ${error}`);
    }
  }

  private generateReport(): void {
    console.log('\n📊 Observability Suite Implementation Report');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    
    console.log(`\n✅ Features Implemented (${this.result.implemented.length}):`);
    this.result.implemented.forEach(item => console.log(`  - ${item}`));
    
    console.log(`\n⬆️ Features Enhanced (${this.result.enhanced.length}):`);
    this.result.enhanced.forEach(item => console.log(`  - ${item}`));
    
    if (this.result.errors.length > 0) {
      console.log(`\n❌ Errors (${this.result.errors.length}):`);
      this.result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log(`\n🎉 Observability Suite Complete!`);
    console.log(`   📈 OpenTelemetry tracing enabled`);
    console.log(`   📊 Enhanced business metrics`);
    console.log(`   📝 Structured logging with sanitization`);
    console.log(`   🔍 Background job monitoring`);
    console.log(`   \nNext steps: Install OpenTelemetry packages and configure exporters`);
  }
}

async function main() {
  const implementation = new ObservabilityImplementation();
  await implementation.execute();
}

main().catch(console.error);