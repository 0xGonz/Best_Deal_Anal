/**
 * Performance Monitoring & Observability
 * 
 * Implements comprehensive request tracing and performance metrics.
 * Addresses Issue #11 from performance audit - Observability gaps.
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { pool } from '../db';

interface PerformanceMetric {
  requestId: string;
  method: string;
  path: string;
  userAgent: string;
  ip: string;
  userId?: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  dbQueries?: number;
  dbTime?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  errorMessage?: string;
  trace?: string[];
}

// In-memory storage for active requests
const activeRequests = new Map<string, PerformanceMetric>();
const recentMetrics: PerformanceMetric[] = [];
const MAX_RECENT_METRICS = 1000;

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  fast: 100,
  normal: 500,
  slow: 1000,
  critical: 3000
};

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  const startCpu = process.cpuUsage();

  // Add request ID to headers for debugging
  res.setHeader('X-Request-ID', requestId);

  const metric: PerformanceMetric = {
    requestId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userId: (req as any).user?.id,
    startTime,
    memoryUsage: startMemory,
    cpuUsage: startCpu,
    trace: []
  };

  // Store active request
  activeRequests.set(requestId, metric);

  // Add database query tracking
  let dbQueryCount = 0;
  let dbTotalTime = 0;

  // Override pool.query to track database calls
  const originalQuery = pool.query.bind(pool);
  (req as any).dbQueryCount = 0;
  (req as any).dbTotalTime = 0;

  const trackDbQuery = async (text: any, params?: any[]) => {
    const dbStart = performance.now();
    try {
      const result = await originalQuery(text, params);
      const dbEnd = performance.now();
      const dbDuration = dbEnd - dbStart;
      
      dbQueryCount++;
      dbTotalTime += dbDuration;
      
      (req as any).dbQueryCount = dbQueryCount;
      (req as any).dbTotalTime = dbTotalTime;
      
      // Log slow queries
      if (dbDuration > 100) {
        console.warn(`🐌 Slow query detected (${dbDuration.toFixed(2)}ms):`, 
          typeof text === 'string' ? text.substring(0, 100) : 'Complex query');
      }
      
      return result;
    } catch (error) {
      const dbEnd = performance.now();
      dbQueryCount++;
      dbTotalTime += (dbEnd - dbStart);
      throw error;
    }
  };

  // Replace pool.query for this request
  (req as any).pool = { query: trackDbQuery };

  // Track response
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(body) {
    captureMetrics(body);
    return originalSend.call(this, body);
  };

  res.json = function(body) {
    captureMetrics(body);
    return originalJson.call(this, body);
  };

  function captureMetrics(responseBody: any) {
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);
    const duration = endTime - startTime;

    // Calculate response size
    let responseSize = 0;
    try {
      responseSize = Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
    } catch (e) {
      responseSize = 0;
    }

    // Update metric
    metric.endTime = endTime;
    metric.duration = duration;
    metric.statusCode = res.statusCode;
    metric.responseSize = responseSize;
    metric.dbQueries = dbQueryCount;
    metric.dbTime = dbTotalTime;
    metric.memoryUsage = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external,
      arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
    };
    metric.cpuUsage = endCpu;

    // Log performance issues
    logPerformanceIssues(metric);

    // Store in recent metrics
    recentMetrics.push(metric);
    if (recentMetrics.length > MAX_RECENT_METRICS) {
      recentMetrics.shift();
    }

    // Remove from active requests
    activeRequests.delete(requestId);

    // Log to database for historical analysis (async, non-blocking)
    setImmediate(() => persistMetric(metric));
  }

  next();
};

// Log performance issues
function logPerformanceIssues(metric: PerformanceMetric) {
  const { duration, path, method, dbQueries, dbTime, statusCode } = metric;

  if (!duration) return;

  // Slow request warning
  if (duration > PERFORMANCE_THRESHOLDS.slow) {
    const level = duration > PERFORMANCE_THRESHOLDS.critical ? '🚨 CRITICAL' : '⚠️ SLOW';
    console.warn(`${level} Request: ${method} ${path} took ${duration.toFixed(2)}ms`);
    
    if (dbQueries && dbQueries > 10) {
      console.warn(`  🔍 High DB query count: ${dbQueries} queries (${dbTime?.toFixed(2)}ms)`);
    }
  }

  // N+1 query detection
  if (dbQueries && dbQueries > 20) {
    console.warn(`🔄 Potential N+1 query detected: ${method} ${path} made ${dbQueries} DB calls`);
  }

  // Error logging
  if (statusCode && statusCode >= 500) {
    console.error(`💥 Server error: ${method} ${path} returned ${statusCode}`);
  }
}

// Persist metric to database for historical analysis
async function persistMetric(metric: PerformanceMetric) {
  try {
    await pool.query(`
      INSERT INTO performance_metrics 
      (request_id, method, path, user_id, duration, status_code, db_queries, db_time, 
       response_size, memory_delta, cpu_user, cpu_system, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
    `, [
      metric.requestId,
      metric.method,
      metric.path,
      metric.userId || null,
      metric.duration,
      metric.statusCode,
      metric.dbQueries || 0,
      metric.dbTime || 0,
      metric.responseSize || 0,
      metric.memoryUsage?.heapUsed || 0,
      metric.cpuUsage?.user || 0,
      metric.cpuUsage?.system || 0
    ]);
  } catch (error) {
    // Don't let performance logging break the app
    console.error('Failed to persist performance metric:', error.message);
  }
}

// Initialize performance metrics table
export async function initializePerformanceMetrics() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        request_id VARCHAR(100) NOT NULL,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(500) NOT NULL,
        user_id INTEGER,
        duration NUMERIC(10,3),
        status_code INTEGER,
        db_queries INTEGER DEFAULT 0,
        db_time NUMERIC(10,3) DEFAULT 0,
        response_size INTEGER DEFAULT 0,
        memory_delta INTEGER DEFAULT 0,
        cpu_user INTEGER DEFAULT 0,
        cpu_system INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Indexes for performance analysis
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at 
      ON performance_metrics(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_duration 
      ON performance_metrics(duration);
      
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_path 
      ON performance_metrics(path);
      
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_slow_queries 
      ON performance_metrics(db_queries) WHERE db_queries > 10;
    `);
    
    console.log('✅ Performance metrics table initialized');
  } catch (error) {
    console.error('Failed to initialize performance metrics:', error);
  }
}

// Get performance dashboard data
export async function getPerformanceMetrics(hours: number = 24): Promise<any> {
  try {
    const [summary, slowRequests, topPaths, dbStats] = await Promise.all([
      // Summary stats
      pool.query(`
        SELECT 
          COUNT(*) as total_requests,
          AVG(duration) as avg_duration,
          MAX(duration) as max_duration,
          AVG(db_queries) as avg_db_queries,
          COUNT(*) FILTER (WHERE duration > 1000) as slow_requests,
          COUNT(*) FILTER (WHERE status_code >= 500) as error_count
        FROM performance_metrics 
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      `),
      
      // Slowest requests
      pool.query(`
        SELECT method, path, duration, db_queries, status_code, created_at
        FROM performance_metrics 
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
        ORDER BY duration DESC 
        LIMIT 10
      `),
      
      // Most requested paths
      pool.query(`
        SELECT 
          path,
          COUNT(*) as request_count,
          AVG(duration) as avg_duration,
          MAX(duration) as max_duration
        FROM performance_metrics 
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
        GROUP BY path
        ORDER BY request_count DESC 
        LIMIT 10
      `),
      
      // Database query stats
      pool.query(`
        SELECT 
          path,
          AVG(db_queries) as avg_queries,
          MAX(db_queries) as max_queries,
          AVG(db_time) as avg_db_time
        FROM performance_metrics 
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
          AND db_queries > 0
        GROUP BY path
        ORDER BY avg_queries DESC 
        LIMIT 10
      `)
    ]);

    return {
      summary: summary.rows[0],
      slowRequests: slowRequests.rows,
      topPaths: topPaths.rows,
      dbStats: dbStats.rows,
      activeRequests: activeRequests.size,
      recentMetricsCount: recentMetrics.length
    };
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    return null;
  }
}

// Get current system health
export function getCurrentSystemHealth() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
    },
    uptime: process.uptime(),
    activeRequests: activeRequests.size,
    recentErrors: recentMetrics.filter(m => m.statusCode && m.statusCode >= 500).length
  };
}

// Cleanup old metrics (run daily)
export async function cleanupOldMetrics(daysToKeep: number = 7) {
  try {
    const result = await pool.query(
      `DELETE FROM performance_metrics 
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'`
    );
    
    console.log(`🧹 Cleaned up ${result.rowCount} old performance metrics`);
  } catch (error) {
    console.error('Failed to cleanup old metrics:', error);
  }
}

// Run cleanup daily
setInterval(() => cleanupOldMetrics(), 24 * 60 * 60 * 1000);