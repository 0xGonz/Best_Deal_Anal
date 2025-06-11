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

  // Register all API routes directly with dynamic imports
  const { default: usersRouter } = await import('./routes/users.js');
  const { default: dealsRouter } = await import('./routes/new-deals.js');
  const { default: fundsRouter } = await import('./routes/funds.js');
  const { default: allocationsRouter } = await import('./routes/allocations.js');
  const { default: capitalCallsRouter } = await import('./routes/new-capital-calls.js');
  const { default: distributionsRouter } = await import('./routes/distributions.js');
  
  app.use('/api/users', usersRouter);
  app.use('/api/deals', dealsRouter);
  app.use('/api/funds', fundsRouter);
  app.use('/api/allocations', allocationsRouter);
  app.use('/api/capital-calls', capitalCallsRouter);
  app.use('/api/distributions', distributionsRouter);
  const { default: closingSchedulesRouter } = await import('./routes/closing-schedules.js');
  const { default: activityRouter } = await import('./routes/activity.js');
  const { default: dashboardRouter } = await import('./routes/dashboard.js');
  const { default: leaderboardRouter } = await import('./routes/leaderboard.js');
  const { default: notificationsRouter } = await import('./routes/notifications.js');
  const { default: calendarRouter } = await import('./routes/calendar.routes.js');
  const { default: meetingsRouter } = await import('./routes/meetings.js');
  const { default: settingsRouter } = await import('./routes/settings.js');
  const { default: v1Router } = await import('./routes/v1/index.js');
  const { default: systemRouter } = await import('./routes/system.js');
  
  app.use('/api/closing-schedules', closingSchedulesRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api/settings', settingsRouter);

  // Version 1 routes
  app.use('/api/v1', v1Router);

  // System routes
  app.use('/api/system', systemRouter);

  return app.listen(process.env.PORT || 3000);
}