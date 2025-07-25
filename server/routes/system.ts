import { Request, Response, Router } from 'express';
import { StorageFactory } from '../storage-factory';
import { DatabaseStorage } from '../database-storage';
import { MemStorage } from '../storage';
import { pool } from '../db';
import { metricsHandler } from '../middleware/metrics';
import { MetricsService, LoggingService } from '../services';
import { 
  getPerformanceMetrics, 
  getCurrentSystemHealth 
} from '../middleware/performance-monitor';
import { jobQueue } from '../services/queue-processor.service';

const metricsService = MetricsService.getInstance();
const logger = LoggingService.getInstance();

export const systemRouter = Router();

// Endpoint to test database connectivity explicitly
systemRouter.post('/database/test-connection', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, connected: true, message: 'Database connection successful' });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(503).json({ 
      success: false, 
      connected: false, 
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Removed obsolete /database/sync-pending endpoint - no longer needed with fixed storage implementation

// Removed obsolete /database/simulate-failure endpoint - testing feature no longer needed

// Removed obsolete /database/restore-normal endpoint - testing feature no longer needed

// Endpoint to check system health
systemRouter.get('/health', async (req: Request, res: Response) => {
  // Log file path to help debugging
  console.log('🔍 Health endpoint called from:', import.meta.url);
  
  // Determine actual session and data storage types - now fixed at startup
  const isMemoryStorage = StorageFactory.storage instanceof MemStorage;
  const isDatabaseStorage = StorageFactory.storage instanceof DatabaseStorage;
  
  // Check session store type from environment variable
  const useMemorySessions = process.env.USE_MEMORY_SESSIONS === "true";
  
  // Return 'pg' as storage type when using PostgreSQL, as required by the documentation
  const storageType = isMemoryStorage ? 'memory' : (useMemorySessions ? 'memory' : 'pg');
  
  console.log('✅ Using fixed session and data store type:', storageType);
  
  // Database connectivity status
  let databaseConnected = false;
  
  try {
    await pool.query('SELECT 1');
    databaseConnected = true;
  } catch (error) {
    logger.error('Health check database query failed:', error as Error);
  }
  
  // Get application metrics
  const metrics = metricsService.getAllMetrics();
  const httpRequestsTotal = metrics.get('http_requests_total')?.value || 0;
  const httpErrorsTotal = metrics.get('http_requests_error_total')?.value || 0;
  const appUptime = metrics.get('app_uptime_seconds')?.value || 0;
  
  // Return system health information with accurate storage type
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    storage: storageType,
    databaseConnected,
    environment: process.env.NODE_ENV,
    metrics: {
      uptime: appUptime,
      requests: httpRequestsTotal,
      errors: httpErrorsTotal,
      errorRate: httpRequestsTotal ? (httpErrorsTotal / httpRequestsTotal) : 0
    }
  };
  
  console.log('📊 Health response:', JSON.stringify(response));
  res.json(response);
});

// Endpoint to expose metrics in Prometheus format
systemRouter.get('/metrics', metricsHandler);

// Performance monitoring endpoints
systemRouter.get('/performance', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await getPerformanceMetrics(hours);
    const systemHealth = getCurrentSystemHealth();
    const queueStats = await jobQueue.getQueueStats();
    
    res.json({
      success: true,
      performance: metrics,
      systemHealth,
      queueStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics'
    });
  }
});

// Queue management endpoints
systemRouter.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await jobQueue.getQueueStats();
    res.json({
      success: true,
      queueStats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve queue statistics'
    });
  }
});

systemRouter.post('/queue/job', async (req: Request, res: Response) => {
  try {
    const { type, payload, priority, delay, maxAttempts } = req.body;
    
    if (!type || !payload) {
      return res.status(400).json({
        success: false,
        error: 'Job type and payload are required'
      });
    }
    
    const jobId = await jobQueue.addJob(type, payload, {
      priority: priority || 0,
      delay: delay || 0,
      maxAttempts: maxAttempts || 3
    });
    
    res.json({
      success: true,
      jobId,
      message: `Job ${type} queued successfully`
    });
  } catch (error) {
    console.error('Failed to queue job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue job'
    });
  }
});