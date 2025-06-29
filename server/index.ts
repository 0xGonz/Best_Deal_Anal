// Server initialization and configuration

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./utils/errorHandlers";
import { pool } from "./db";
import * as fs from 'fs';
import * as path from 'path';
import connectPgSimple from 'connect-pg-simple';
import memorystore from 'memorystore';
import { StorageFactory } from "./storage-factory";
import { initJobQueues } from "./jobs";
import { metricsMiddleware } from "./middleware/metrics";
import { LoggingService } from "./services";

// Performance improvements imports
import { 
  uploadLimiter, 
  uploadRateLimit, 
  validateContentLength, 
  handleUploadErrors, 
  cleanupTempFiles 
} from "./middleware/upload-limits";
import { 
  idempotencyMiddleware, 
  initializeIdempotencyTable 
} from "./middleware/idempotency";
import { 
  tenantIsolationMiddleware, 
  initializeOrgTables, 
  initializeSecurityAuditLog 
} from "./middleware/multi-tenant-security";
import { 
  performanceMonitor, 
  initializePerformanceMetrics 
} from "./middleware/performance-monitor";
import { jobQueue } from "./services/queue-processor.service";

// Main async function to allow using await
async function initialize() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  // Create temp directory for file uploads if it doesn't exist
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp');
  }

  // ─── SESSION CONFIGURATION - SINGLE POINT OF TRUTH ─────────────────────────
  // Initialize the StorageFactory to use the hybrid storage implementation
  const storage = StorageFactory.getStorage();

  // Create the appropriate session store classes
  const PgSession = connectPgSimple(session);
  const MemoryStore = memorystore(session);

  // Always use PostgreSQL for sessions in production to ensure consistency
  // Memory sessions should only be used for development or testing
  const isProd = process.env.NODE_ENV === 'production';
  const forceUseMemory = process.env.USE_MEMORY_SESSIONS === "true";

  // Default to PostgreSQL in production, regardless of USE_MEMORY_SESSIONS setting
  // This prevents accidental session store switching in production
  let sessionStore;

  // Function to create memory store with consistent settings
  const createMemoryStore = () => {
    return new MemoryStore({ 
      checkPeriod: 86400000,  // 24 hours
      stale: true             // Remove stale entries
    });
  };

  // For testing in Replit, we might see database connection issues
  // Let's add a more robust approach for testing environments
  let isDbHealthy = true;

  // Test database connection first with a simple query with short timeout
  try {
    // Perform a quick check to see if database is responsive
    const testResult = await new Promise((resolve, reject) => {
      const testTimeout = setTimeout(() => {
        isDbHealthy = false;
        reject(new Error("Database connection test timed out after 2 seconds"));
      }, 2000);
      
      pool.query('SELECT 1 AS test')
        .then(result => {
          clearTimeout(testTimeout);
          isDbHealthy = true;
          resolve(result);
        })
        .catch(err => {
          clearTimeout(testTimeout);
          isDbHealthy = false;
          reject(err);
        });
    });
    

  } catch (error: any) {
    console.error("Database connectivity check failed:", error.message);
    isDbHealthy = false;
  }

  // Choose session store based on environment and database health
  if ((isProd || !forceUseMemory) && isDbHealthy) {
    // Use PostgreSQL in production or when not explicitly using memory
    try {
      sessionStore = new PgSession({ 
        pool, 
        tableName: "session",
        createTableIfMissing: true,
        pruneSessionInterval: 60, // Prune expired sessions every 60 seconds
        // Add error handling to be more resilient
        errorLog: (err) => console.error("PgSession error:", err)
      });

    } catch (error) {
      console.error("Failed to create PostgreSQL session store:", error);
      if (isProd) {
        throw new Error("Cannot run in production without PostgreSQL session store");
      } else {
        // Fallback to memory store only in dev mode
        sessionStore = createMemoryStore();

      }
    }
  } else {
    // Use memory store due to explicit request or database health issues
    sessionStore = createMemoryStore();
    

  }



  // Add metrics middleware to track request metrics
  app.use(metricsMiddleware());

  // Configure CORS to allow cross-origin requests for development/embedding
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Configure the session middleware
  app.set('trust proxy', 1); // Trust first proxy for secure cookies behind a proxy

  // Apply session middleware with a fixed store chosen at startup
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "dlf-dev-secret",
      name: "dlf.sid",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: false, // Set to false for both dev and prod to avoid HTTPS issues
        sameSite: 'lax',
      },
    })
  );



  // Ensure the persistent uploads directory exists
  const uploadDir = path.join(process.cwd(), 'data/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });

  }
  
  // Also ensure old public/uploads exists for backwards compatibility
  const publicUploadDir = path.join(process.cwd(), 'public/uploads');
  if (!fs.existsSync(publicUploadDir)) {
    fs.mkdirSync(publicUploadDir, { recursive: true });
  }

  // Serve uploads from persistent data directory and pdfjs from public
  const rootPublic = path.resolve(process.cwd(), 'public');
  const dataUploads = path.resolve(process.cwd(), 'data/uploads');
  app.use('/uploads', express.static(dataUploads));
  app.use('/pdfjs', express.static(path.join(rootPublic, 'pdfjs')));
  
  // Serve PDF worker file directly from public root
  app.use(express.static(rootPublic));
  console.log('Configured static file serving for uploads and PDF.js worker');

  // Initialize background job queues
  try {
    initJobQueues();

  } catch (error) {
    console.error('Failed to initialize background jobs:', error);

  }
  
  // Auto-allocation sync system disabled due to data corruption issues
  // TODO: Fix status logic before re-enabling

  
  const server = await registerRoutes(app);

  // Error handling is centralized in routes.ts

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use configurable port from environment variables
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || '0.0.0.0';
  
  // Add error handling for port conflicts
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Trying port ${port + 1}...`);
      server.listen({
        port: port + 1,
        host,
        reusePort: true,
      }, () => {
        log(`serving on ${host}:${port + 1}`);
      });
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
  
  server.listen({
    port,
    host,
    reusePort: true,
  }, () => {
    log(`serving on ${host}:${port}`);
  });
}

// Execute the main function
initialize().catch(error => {
  console.error('Failed to initialize application:', error);
  process.exit(1);
});