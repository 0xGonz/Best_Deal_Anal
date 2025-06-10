// Add debug print to confirm this is the actual boot file
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const moduleUrl = import.meta.url;
const modulePath = fileURLToPath(moduleUrl);

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
// Job queues removed for modular cleanup
import { metricsMiddleware } from "./middleware/metrics";
// Removed // LoggingService import - simplified logging

// Main async function to allow using await
async function initialize() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

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
        pruneSessionInterval: 300, // Reduced frequency to 5 minutes to prevent timeouts
        ttl: 86400, // 24 hours session timeout
        disableTouch: false, // Enable session touch to prevent premature expiry
      });
    } catch (error) {
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
    
    if (forceUseMemory) {
    } else {
    }
  }

  // Debug the session store to verify it remains consistent

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

  // Session debugging (only in development and only for login/logout)
  app.use((req, res, next) => {
    if (!isProd && (req.path === '/api/auth/login' || req.path === '/api/auth/logout')) {
      const sessionID = req.sessionID?.substring(0, 10) + '...';
      const hasSession = !!req.session;
      const userId = req.session?.userId;
    }
    next();
  });

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

  // Initialize background job queues
  try {
    // Job queue initialization removed for modularity
  } catch (error) {
  }
  
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
  process.exit(1);
});