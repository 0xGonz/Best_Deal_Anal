import express, { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
// Removed broken routes import
import { users } from '@shared/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Debug middleware to log session consistency issues
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/closing-schedules') {
      // Print session data for debugging
      if (req.session) {
        // Session debugging removed
      }
    }
    next();
  });
  
  // Middleware to attach user object to request - enhanced with error handling
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip user attachment for certain routes
      if (req.path === '/health' || req.path === '/status') {
        return next();
      }
      
      // Only process if we have session and userId
      if (req.session && req.session.userId) {
        try {
          const userRecord = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
          if (userRecord.length > 0) {
            (req as any).user = userRecord[0];
          }
        } catch (userError) {
          // User lookup failed, continue without user
        }
      }
      
      next();
    } catch (error) {
      next();
    }
  });

  // Middleware to ensure session consistency
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    next();
  });

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      
      // Test database connection
      let databaseConnected = false;
      try {
        await db.select().from(users).limit(1);
        databaseConnected = true;
      } catch (dbError) {
        // Database connection failed
      }
      
      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        storage: 'pg', 
        databaseConnected,
        environment: process.env.NODE_ENV || 'development',
        metrics: {
          uptime: process.uptime(),
          requests: 0,
          errors: 0,
          errorRate: 0
        }
      };
      
      res.json(response);
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Register all API routes directly
  app.use('/api/users', require('./routes/users').default);
  app.use('/api/deals', require('./routes/new-deals').default);
  app.use('/api/funds', require('./routes/funds').default);
  app.use('/api/allocations', require('./routes/allocations').default);
  app.use('/api/capital-calls', require('./routes/new-capital-calls').default);
  app.use('/api/distributions', require('./routes/distributions').default);
  app.use('/api/closing-schedules', require('./routes/closing-schedules').default);
  
  app.use('/api/activity', require('./routes/activity').default);
  app.use('/api/dashboard', require('./routes/dashboard').default);
  app.use('/api/leaderboard', require('./routes/leaderboard').default);
  app.use('/api/notifications', require('./routes/notifications').default);
  app.use('/api/calendar', require('./routes/calendar.routes').default);
  app.use('/api/meetings', require('./routes/meetings').default);
  app.use('/api/settings', require('./routes/settings').default);

  // Version 1 routes
  app.use('/api/v1', require('./routes/v1/index').default);

  // System routes
  app.use('/api/system', require('./routes/system').default);

  return app.listen(process.env.PORT || 3000);
}