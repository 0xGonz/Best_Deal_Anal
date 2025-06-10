/**
 * Simplified metrics middleware
 */

import { Request, Response, NextFunction } from 'express';

// Simple in-memory metrics
let requestCount = 0;
let errorCount = 0;
const startTime = Date.now();

/**
 * Simplified metrics middleware
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      requestCount++;
      if (res.statusCode >= 400) {
        errorCount++;
      }
      
      const duration = (Date.now() - start) / 1000;
      if (process.env.NODE_ENV !== 'production') {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('user-agent')
        }));
      }
    });
    
    next();
  };
}

/**
 * Simple metrics handler
 */
export function metricsHandler(req: Request, res: Response) {
  const uptime = (Date.now() - startTime) / 1000;
  const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
  
  res.json({
    uptime,
    requests: requestCount,
    errors: errorCount,
    errorRate
  });
}