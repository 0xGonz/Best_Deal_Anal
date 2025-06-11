import { Request, Response, Router } from 'express';
import { StorageFactory } from '../storage-factory';
import { DatabaseStorage } from '../database-storage';
import { MemStorage } from '../storage';
import { pool } from '../db';
import { metricsHandler } from '../middleware/metrics';
import { MetricsService, LoggingService } from '../services';

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

// Endpoint to force synchronization of pending operations
systemRouter.post('/database/sync-pending', async (req: Request, res: Response) => {
  // We no longer use hybrid storage, but keep endpoint for compatibility
  console.log('Received sync-pending request - operation now obsolete');
  
  res.json({ 
    success: true, 
    message: 'No action needed - using fixed storage implementation',
    pendingOperations: 0
  });
});

// Endpoint to simulate database failure for testing (admin only)
systemRouter.post('/database/simulate-failure', (req: Request, res: Response) => {
  // Check if user is authenticated and has admin role
  if (!req.session?.userId || req.session?.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized - admin access required'
    });
  }
  
  // We no longer use hybrid storage, but keep endpoint for compatibility
  console.log('Received database-failure simulation request - operation now obsolete');
  
  res.json({ 
    success: true, 
    message: 'Feature disabled - using fixed storage implementation',
    mode: StorageFactory.storage instanceof MemStorage ? 'memory' : 'database'
  });
});

// Endpoint to restore normal operation after testing (admin only)
systemRouter.post('/database/restore-normal', async (req: Request, res: Response) => {
  // Check if user is authenticated and has admin role
  if (!req.session?.userId || req.session?.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized - admin access required'
    });
  }
  
  // We no longer use hybrid storage, but keep endpoint for compatibility
  console.log('Received restore-normal request - operation now obsolete');
  
  // Check if database is connected
  try {
    await pool.query('SELECT 1');
    
    res.json({ 
      success: true, 
      message: 'Database is already operating normally',
      mode: StorageFactory.storage instanceof MemStorage ? 'memory' : 'database',
      connected: true
    });
  } catch (dbError) {
    res.status(503).json({ 
      success: false, 
      message: 'Database connection issue detected',
      error: dbError instanceof Error ? dbError.message : String(dbError),
      mode: StorageFactory.storage instanceof MemStorage ? 'memory' : 'database',
      connected: false
    });
  }
});

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