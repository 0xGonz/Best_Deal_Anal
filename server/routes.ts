import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";

// Route imports
import dealsRoutes from './routes/deals';
import fundsRoutes from './routes/funds';
import usersRoutes from './routes/users';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import leaderboardRoutes from './routes/leaderboard';
import activityRoutes from './routes/activity';
import notificationsRoutes from './routes/notifications';
import documentsRoutes from './routes/documents';
import distributionsRoutes from './routes/distributions';
// Removed legacy allocations route - using production-allocations only
import productionAllocationsRouter from './routes/production-allocations';
import capitalCallsRoutes from './routes/capital-calls';
import capitalCallManagementRoutes from './routes/capital-call-management';
import closingSchedulesRoutes from './routes/closing-schedules';
import meetingsRoutes from './routes/meetings';
import calendarRoutes from './routes/calendar.routes'; // New unified calendar API
import { systemRouter } from './routes/system';
import v1Router from './routes/v1/index'; // V1 API routes including AI analysis
import aiAnalysisRoutes from './routes/ai-analysis';
import enumsRoutes from './routes/enums';
import fundOverviewRoutes from './routes/fund-overview';
import databaseExportRoutes from './routes/database-export';

// Utils
import { errorHandler, notFoundHandler } from './utils/error-handler';
import { requireAuth, getCurrentUser } from './utils/auth';
import { pool } from './db';

export async function registerRoutes(app: Express): Promise<Server> {
  

  
  // Middleware to attach user object to request - enhanced with error handling
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.session?.userId) {
        const user = await getCurrentUser(req);
        (req as any).user = user;
      }
      next();
    } catch (error) {
      console.error('Error in user middleware:', error);
      // Continue even with error to avoid breaking the request
      next();
    }
  });
  
  // Authentication middleware for all API routes except auth endpoints and system endpoints
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    // Skip auth check for auth/system endpoints and OPTIONS requests
    if (req.path.startsWith('/auth') || 
        req.path.startsWith('/system') || 
        req.method === 'OPTIONS') {
      return next();
    }
    
    // Require authentication for all other API routes
    requireAuth(req, res, next);
  });
  
  // Register route modules
  app.use('/api/deals', dealsRoutes);
  app.use('/api/funds', fundsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/auth', authRoutes);
  // Production allocation routes (current architecture)
  app.use('/api/production/allocations', productionAllocationsRouter);
  app.use('/api/allocations', productionAllocationsRouter); // Updated to use production allocations after cleanup
  app.use('/api/capital-calls', capitalCallsRoutes);
  app.use('/api/capital-call-management', capitalCallManagementRoutes);
  app.use('/api/closing-schedules', closingSchedulesRoutes);
  app.use('/api/meetings', meetingsRoutes);
  app.use('/api/calendar', calendarRoutes); // New unified calendar API endpoint
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/documents', documentsRoutes);
  app.use('/api/distributions', distributionsRoutes);
  app.use('/api/enums', enumsRoutes); // Centralized enum values for dropdowns
  app.use('/api/fund-overview', fundOverviewRoutes); // Single source of truth for fund metrics
  app.use('/api/database-export', databaseExportRoutes); // Database export for app cloning
  app.use('/api/system', systemRouter);
  app.use('/api/v1', v1Router); // V1 API routes including AI analysis
  app.use('/api/ai-analysis', aiAnalysisRoutes); // Direct access to AI analysis
  
  // Catch-all route for 404s
  app.use('/api/*', notFoundHandler);
  
  // Apply centralized error handling middleware
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}