/**
 * OpenTelemetry Instrumentation Setup
 * 
 * Provides distributed tracing for HTTP requests, database queries, and background jobs.
 * Addresses the observability gap identified in the external audit.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
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

// Console exporter for development (replace with Jaeger in production)
const consoleExporter = new ConsoleSpanExporter();

// SDK configuration
const sdk = new NodeSDK({
  resource,
  traceExporter: consoleExporter,
  spanProcessor: isDev ? 
    new SimpleSpanProcessor(consoleExporter) : 
    new BatchSpanProcessor(consoleExporter),
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

// Initialize the SDK (only if not disabled)
if (process.env.TELEMETRY_DISABLED !== 'true') {
  console.log('📈 Initializing OpenTelemetry instrumentation...');
  sdk.start();
  console.log('📈 OpenTelemetry instrumentation initialized successfully');
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