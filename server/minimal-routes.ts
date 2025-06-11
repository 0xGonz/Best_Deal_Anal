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

  // Routes registered successfully
}