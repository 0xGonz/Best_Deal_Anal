import { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { versioningMiddleware } from "../middleware/versioning";
import { standardRateLimiter, authRateLimiter, apiRateLimiter } from "../middleware/rateLimit";
import v1Routes from './v1';
import { systemRouter } from './system';

// Create a simple auth middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // For MVP, we're not implementing real auth
  // In a real app, this would check JWT tokens, session data, etc.
  // Just simulate a logged-in user
  (req as any).user = { id: 2, role: 'partner' }; // John Doe as default user
  next();
};

// Error handling middleware
const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'An unexpected error occurred', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
};

export function registerRoutes(app: Express): Server {
  // Apply versioning middleware to all API routes
  app.use('/api', versioningMiddleware(1));
  
  // Apply authentication middleware to all API routes
  app.use('/api', authenticate);
  
  // Apply stricter rate limits to authentication-related endpoints
  app.use('/api/v1/auth', authRateLimiter);
  app.use('/api/auth', authRateLimiter);
  
  // Apply API rate limiting to versioned routes
  app.use('/api/v1', apiRateLimiter, v1Routes);
  
  // For backwards compatibility, also route the base /api/* to current version with rate limiting
  app.use('/api', apiRateLimiter, v1Routes);
  
  // System routes with standard rate limiting
  app.use('/api/system', standardRateLimiter, systemRouter);
  
  // API Documentation route with standard rate limiting
  app.get('/api', standardRateLimiter, (req, res) => {
    res.json({
      name: 'Investment Lifecycle Tracking API',
      versions: ['1'],
      currentVersion: '1',
      documentation: 'To specify API version, use /api/v1/* or pass version=1 in Accept header'
    });
  });
  
  // Catch-all route for 404s
  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
  });
  
  // Apply error handling middleware
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}