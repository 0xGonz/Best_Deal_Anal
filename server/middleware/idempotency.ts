/**
 * Request Idempotency Middleware
 * 
 * Implements idempotent request handling to prevent duplicate operations.
 * Addresses Issue #3 from performance audit - Non-idempotent allocation workflow.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { pool } from '../db';

interface IdempotencyRecord {
  request_id: string;
  request_hash: string;
  response_status: number;
  response_body: string;
  created_at: Date;
}

// Create idempotency table if it doesn't exist
export async function initializeIdempotencyTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_idempotency (
        request_id VARCHAR(255) PRIMARY KEY,
        request_hash VARCHAR(255) NOT NULL,
        response_status INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
      );
      
      -- Index for cleanup
      CREATE INDEX IF NOT EXISTS idx_request_idempotency_expires_at 
      ON request_idempotency(expires_at);
      
      -- Index for hash lookups
      CREATE INDEX IF NOT EXISTS idx_request_idempotency_hash 
      ON request_idempotency(request_hash);
    `);
  } catch (error) {
    console.error('Failed to initialize idempotency table:', error);
  }
}

// Generate request hash for deduplication
function generateRequestHash(req: Request): string {
  const hashData = {
    method: req.method,
    path: req.path,
    body: req.body,
    userId: req.session?.userId,
    // Include key headers that affect business logic
    userAgent: req.headers['user-agent'],
  };
  
  return createHash('sha256')
    .update(JSON.stringify(hashData))
    .digest('hex');
}

// Middleware to handle idempotent requests
export const idempotencyMiddleware = (options: { 
  keyHeader?: string;
  ttlHours?: number;
  methods?: string[];
} = {}) => {
  const {
    keyHeader = 'x-idempotency-key',
    ttlHours = 24,
    methods = ['POST', 'PUT', 'PATCH']
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to specified HTTP methods
    if (!methods.includes(req.method)) {
      return next();
    }

    // Skip for non-business logic endpoints and file uploads
    const skipPaths = ['/auth/', '/system/', '/health', '/documents/upload'];
    if (skipPaths.some(path => req.path.includes(path))) {
      return next();
    }

    let requestId = req.headers[keyHeader] as string;
    
    // If no idempotency key provided, generate one based on request content
    if (!requestId) {
      const requestHash = generateRequestHash(req);
      
      try {
        // Check if we've seen this exact request before
        const existingResult = await pool.query(
          `SELECT request_id, response_status, response_body, created_at 
           FROM request_idempotency 
           WHERE request_hash = $1 AND expires_at > CURRENT_TIMESTAMP 
           ORDER BY created_at DESC LIMIT 1`,
          [requestHash]
        );

        if (existingResult.rows.length > 0) {
          const record = existingResult.rows[0];
          console.log(`Returning cached response for duplicate request: ${record.request_id}`);
          
          return res
            .status(record.response_status)
            .set('X-Idempotency-Replay', 'true')
            .set('X-Original-Request-Id', record.request_id)
            .json(JSON.parse(record.response_body));
        }
        
        // Generate new request ID for this unique request
        requestId = uuidv4();
        req.headers[keyHeader] = requestId;
        
      } catch (error) {
        console.error('Idempotency check failed:', error);
        // Continue with request if idempotency check fails
        requestId = uuidv4();
        req.headers[keyHeader] = requestId;
      }
    }

    // Check if this specific request ID was already processed
    try {
      const existingResult = await pool.query(
        `SELECT response_status, response_body, created_at 
         FROM request_idempotency 
         WHERE request_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [requestId]
      );

      if (existingResult.rows.length > 0) {
        const record = existingResult.rows[0];
        console.log(`Returning cached response for request ID: ${requestId}`);
        
        return res
          .status(record.response_status)
          .set('X-Idempotency-Replay', 'true')
          .json(JSON.parse(record.response_body));
      }
    } catch (error) {
      console.error('Idempotency lookup failed:', error);
      // Continue with request if lookup fails
    }

    // Store request ID for later use
    (req as any).idempotencyKey = requestId;
    (req as any).requestHash = generateRequestHash(req);

    // Intercept response to cache it
    const originalSend = res.send;
    const originalJson = res.json;
    
    let responseCaptured = false;
    
    const captureResponse = (body: any, status: number) => {
      if (responseCaptured) return;
      responseCaptured = true;
      
      // Only cache successful responses and some client errors (to prevent retries)
      if (status < 500) {
        setImmediate(async () => {
          try {
            await pool.query(
              `INSERT INTO request_idempotency 
               (request_id, request_hash, response_status, response_body, expires_at) 
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '${ttlHours} hours')
               ON CONFLICT (request_id) DO NOTHING`,
              [
                requestId,
                (req as any).requestHash,
                status,
                JSON.stringify(body)
              ]
            );
          } catch (error) {
            console.error('Failed to cache idempotent response:', error);
          }
        });
      }
    };

    res.send = function(body) {
      captureResponse(body, this.statusCode);
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      captureResponse(body, this.statusCode);
      return originalJson.call(this, body);
    };

    next();
  };
};

// Cleanup expired idempotency records
export async function cleanupExpiredIdempotencyRecords() {
  try {
    const result = await pool.query(
      `DELETE FROM request_idempotency WHERE expires_at < CURRENT_TIMESTAMP`
    );
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} expired idempotency records`);
    }
  } catch (error) {
    console.error('Failed to cleanup expired idempotency records:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredIdempotencyRecords, 60 * 60 * 1000);