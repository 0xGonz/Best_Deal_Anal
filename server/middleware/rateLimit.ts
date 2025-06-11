/**
 * Rate limiting middleware to protect against abuse
 * This implements a token bucket algorithm for flexible rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../services/LoggingService';

// Interface for rate limit configuration
interface RateLimitConfig {
  tokensPerInterval: number; // How many tokens to add per interval
  interval: number; // Interval in milliseconds
  burstCapacity: number; // Maximum number of tokens that can be stored
}

// Interface for a rate limit bucket
interface RateLimitBucket {
  tokens: number; // Current number of tokens
  lastRefill: number; // Timestamp of last refill
}

// Default configurations for different endpoint types
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  standard: {
    tokensPerInterval: 20,
    interval: 60000, // 1 minute
    burstCapacity: 30
  },
  auth: {
    tokensPerInterval: 10,
    interval: 300000, // 5 minutes
    burstCapacity: 15
  },
  api: {
    tokensPerInterval: 100,
    interval: 60000, // 1 minute
    burstCapacity: 150
  }
};

/**
 * Rate limiter based on token bucket algorithm
 */
export class RateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private config: RateLimitConfig;
  private logger: LoggingService;
  
  /**
   * Create a new rate limiter
   */
  constructor(config?: Partial<RateLimitConfig>, configType: keyof typeof DEFAULT_CONFIGS = 'standard') {
    this.config = {
      ...DEFAULT_CONFIGS[configType],
      ...config
    };
    
    this.logger = LoggingService.getInstance();
    
    // Clean up buckets periodically to prevent memory leaks
    setInterval(() => this.cleanupBuckets(), 10 * 60 * 1000); // Every 10 minutes
  }
  
  /**
   * Try to consume a token from a bucket
   */
  public consume(key: string, tokens: number = 1): boolean {
    // Get or create bucket
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: this.config.burstCapacity,
        lastRefill: Date.now()
      };
      this.buckets.set(key, bucket);
    }
    
    // Refill tokens based on time passed
    this.refillBucket(bucket);
    
    // Check if there are enough tokens
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  /**
   * Refill a bucket based on time passed
   */
  private refillBucket(bucket: RateLimitBucket): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    
    if (timePassed <= 0) {
      return;
    }
    
    // Calculate how many tokens to add
    const tokensToAdd = (timePassed / this.config.interval) * this.config.tokensPerInterval;
    
    if (tokensToAdd > 0) {
      // Update bucket
      bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.config.burstCapacity);
      bucket.lastRefill = now;
    }
  }
  
  /**
   * Clean up buckets that haven't been used recently
   */
  private cleanupBuckets(): void {
    const now = Date.now();
    const expirationTime = 30 * 60 * 1000; // 30 minutes
    
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > expirationTime) {
        this.buckets.delete(key);
      }
    }
    
    this.logger.debug(`Rate limiter buckets cleaned up. Current buckets: ${this.buckets.size}`);
  }
}

/**
 * Get a key for rate limiting based on the request
 */
function getRateLimitKey(req: Request): string {
  // Use IP address as the default key
  let key = req.ip || req.socket.remoteAddress || 'unknown-ip';
  
  // If the user is logged in, use their ID as part of the key
  if (req.session?.userId) {
    key = `${key}:user:${req.session.userId}`;
  }
  
  // Optionally, add the route to the key for more granular limiting
  key = `${key}:${req.method}:${req.path}`;
  
  return key;
}

/**
 * Create middleware for rate limiting
 */
export function createRateLimiter(configType: keyof typeof DEFAULT_CONFIGS = 'standard', config?: Partial<RateLimitConfig>) {
  const rateLimiter = new RateLimiter(config, configType);
  const logger = LoggingService.getInstance();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getRateLimitKey(req);
    
    if (rateLimiter.consume(key)) {
      next();
    } else {
      logger.warn(`Rate limit exceeded for ${key}`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.session?.userId
      });
      
      // Set headers to inform the client about rate limiting
      res.set('Retry-After', Math.ceil(DEFAULT_CONFIGS[configType].interval / 1000).toString());
      res.set('X-RateLimit-Limit', DEFAULT_CONFIGS[configType].tokensPerInterval.toString());
      
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(DEFAULT_CONFIGS[configType].interval / 1000)
      });
    }
  };
}

// Export default rate limiters for common endpoint types
export const standardRateLimiter = createRateLimiter('standard');
export const authRateLimiter = createRateLimiter('auth');
export const apiRateLimiter = createRateLimiter('api');