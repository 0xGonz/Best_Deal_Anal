/**
 * Database helpers for optimizing read and write operations
 */

import { SQL } from 'drizzle-orm';
import { primaryDB, readDB } from '../db-read-replica';
import { CacheService } from '../services/CacheService';
import { LoggingService } from '../services/LoggingService';
import { MetricsService } from '../services/MetricsService';

// Get service instances
const cache = CacheService.getInstance();
const logger = LoggingService.getInstance();
const metricsService = MetricsService.getInstance();

/**
 * Perform a database read operation with caching and read replicas
 * 
 * @param queryFunction The function that performs the actual query
 * @param cacheKey Optional cache key to store the results
 * @param ttlSeconds Optional TTL in seconds for cache
 * @returns Query results
 */
export async function optimizedRead<T>(
  queryFunction: (db: typeof readDB) => Promise<T>,
  cacheKey?: string,
  ttlSeconds: number = 300
): Promise<T> {
  // Start timing for metrics
  const startTime = process.hrtime();
  
  try {
    // Check cache first if a cache key is provided
    if (cacheKey) {
      const cachedResult = cache.get<T>(cacheKey);
      if (cachedResult) {
        metricsService.incrementCounter('db_cache_hits');
        return cachedResult;
      }
      metricsService.incrementCounter('db_cache_misses');
    }
    
    // Perform the query using read database
    const result = await queryFunction(readDB);
    
    // Cache the result if a cache key is provided
    if (cacheKey && result) {
      cache.set(cacheKey, result, ttlSeconds);
    }
    
    // Record query metrics
    const hrTime = process.hrtime(startTime);
    const durationMs = hrTime[0] * 1000 + hrTime[1] / 1000000;
    metricsService.observeHistogram('db_read_duration_ms', durationMs);
    
    return result;
  } catch (error) {
    // On failure, retry once with primary database
    logger.warn('Read replica query failed, falling back to primary', {
      error: (error as Error).message,
      cacheKey
    });
    
    metricsService.incrementCounter('db_read_fallbacks');
    
    // Retry with primary database
    const result = await queryFunction(primaryDB);
    
    // Cache the result if a cache key is provided
    if (cacheKey && result) {
      cache.set(cacheKey, result, ttlSeconds);
    }
    
    return result;
  }
}

/**
 * Perform a database write operation and invalidate related caches
 * 
 * @param writeFunction The function that performs the actual write
 * @param invalidateCacheKeys Cache keys to invalidate after successful write
 * @returns Write operation results
 */
export async function optimizedWrite<T>(
  writeFunction: (db: typeof primaryDB) => Promise<T>,
  invalidateCacheKeys: string[] = []
): Promise<T> {
  // Start timing for metrics
  const startTime = process.hrtime();
  
  try {
    // Always perform writes on the primary database
    const result = await writeFunction(primaryDB);
    
    // Invalidate cache keys
    for (const key of invalidateCacheKeys) {
      cache.del(key);
    }
    
    // Record query metrics
    const hrTime = process.hrtime(startTime);
    const durationMs = hrTime[0] * 1000 + hrTime[1] / 1000000;
    metricsService.observeHistogram('db_write_duration_ms', durationMs);
    
    return result;
  } catch (error) {
    // Log the error
    logger.error('Database write operation failed', {
      error: (error as Error).message
    });
    
    // Record failure metric
    metricsService.incrementCounter('db_write_failures');
    
    // Re-throw the error for handling by the caller
    throw error;
  }
}

/**
 * Generate a standardized cache key for database queries
 * 
 * @param entityType The type of entity (e.g., 'user', 'deal')
 * @param operation The operation (e.g., 'get', 'list', 'count')
 * @param identifier Optional identifier (e.g., entity ID)
 * @param params Optional parameters that affect the query
 * @returns Formatted cache key
 */
export function generateCacheKey(
  entityType: string,
  operation: string,
  identifier?: string | number,
  params?: Record<string, any>
): string {
  let key = `db:${entityType}:${operation}`;
  
  if (identifier !== undefined) {
    key += `:${identifier}`;
  }
  
  if (params) {
    // Sort params to ensure consistent cache keys regardless of object property order
    const sortedParams = Object.keys(params).sort().reduce(
      (obj, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          obj[key] = params[key];
        }
        return obj;
      }, 
      {} as Record<string, any>
    );
    
    key += `:${JSON.stringify(sortedParams)}`;
  }
  
  return key;
}