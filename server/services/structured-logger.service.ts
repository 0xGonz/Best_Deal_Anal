/**
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
    this.info(`Allocation ${operation}`, {
      ...context,
      operation: `allocation:${operation}`,
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
    this.info(`Capital call ${operation}`, {
      ...context,
      operation: `capital_call:${operation}`,
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
    this.info(`Document ${operation}`, {
      ...context,
      operation: `document:${operation}`,
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
