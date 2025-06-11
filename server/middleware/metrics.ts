/**
 * Metrics middleware for Express applications
 * Records request metrics and provides a /metrics endpoint
 */

import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../services/MetricsService';
import { LoggingService } from '../services/LoggingService';

/**
 * Express middleware that records request metrics
 */
export function metricsMiddleware() {
  const metricsService = MetricsService.getInstance();
  const logger = LoggingService.getInstance();
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Mark the start time for request duration measurement
    const startTime = process.hrtime();
    
    // Store the original end method
    const originalEnd = res.end;
    
    // Override the end method to record metrics when the response is sent
    res.end = function(chunk?: any, encoding?: any): any {
      // Calculate request duration
      const hrTime = process.hrtime(startTime);
      const durationSeconds = hrTime[0] + (hrTime[1] / 1000000000);
      
      // Record request metrics
      try {
        metricsService.recordHttpRequest(
          req.method,
          req.path,
          res.statusCode,
          durationSeconds
        );
        
        // Log request details for debugging/tracing
        if (process.env.NODE_ENV !== 'production') {
          logger.debug(`${req.method} ${req.path} ${res.statusCode} ${durationSeconds.toFixed(3)}s`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: durationSeconds,
            ip: req.ip,
            userAgent: req.get('user-agent')
          });
        }
      } catch (error) {
        logger.error('Error recording metrics', error as Error);
      }
      
      // Call the original end method
      return originalEnd.apply(res, arguments as any);
    };
    
    next();
  };
}

/**
 * Express handler that exposes metrics in Prometheus format
 */
export function metricsHandler(req: Request, res: Response) {
  const metricsService = MetricsService.getInstance();
  
  res.set('Content-Type', 'text/plain');
  res.send(metricsService.formatMetricsForPrometheus());
}

/**
 * Reset or initialize request metrics
 */
export function resetRequestMetrics() {
  const metricsService = MetricsService.getInstance();
  
  // Reset HTTP request metrics
  metricsService.setCounter('http_requests_total', 0);
  metricsService.setCounter('http_requests_error_total', 0);
  metricsService.setHistogram('http_request_duration_seconds', {
    buckets: [
      { le: 0.01, count: 0 },
      { le: 0.05, count: 0 },
      { le: 0.1, count: 0 },
      { le: 0.5, count: 0 },
      { le: 1, count: 0 },
      { le: 5, count: 0 },
      { le: 10, count: 0 },
      { le: Infinity, count: 0 }
    ],
    sum: 0,
    count: 0
  });
}