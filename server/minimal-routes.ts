import express, { Express, Request, Response } from 'express';

export async function registerMinimalRoutes(app: Express): Promise<void> {
  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  // Basic API endpoint
  app.get('/api/status', async (req: Request, res: Response) => {
    try {
      res.json({ 
        status: 'running', 
        message: 'Server is operational',
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ error: 'Status check failed' });
    }
  });

  // System health endpoint for frontend
  app.get('/api/system/health', async (req: Request, res: Response) => {
    try {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        storage: { type: 'memory' },
        session: { type: 'memory' },
        database: { connected: false },
        metrics: {
          uptime: process.uptime(),
          requests: 0,
          errors: 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'System health check failed' });
    }
  });

  // Routes registered successfully
}