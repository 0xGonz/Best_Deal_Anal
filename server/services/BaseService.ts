import { IStorage } from '../storage';
import { StorageFactory } from '../storage-factory';
import { primaryDB, readDB } from '../db-read-replica';
import { optimizedRead, optimizedWrite, generateCacheKey } from '../utils/db-helpers';
import { CacheService } from './CacheService';
import { LoggingService } from './LoggingService';

/**
 * Base Service class that provides access to storage
 * and common utility methods for all services
 */
export class BaseService {
  protected storage: IStorage;
  protected primaryDB = primaryDB;
  protected readDB = readDB;
  protected cache = CacheService.getInstance();
  protected logger = LoggingService.getInstance();
  
  constructor(storage?: IStorage) {
    // Allow for dependency injection but default to factory
    this.storage = storage || StorageFactory.getStorage();
    this.logger.info(`${this.constructor.name} initialized`);
  }
  
  /**
   * Get the current storage instance
   */
  getStorage(): IStorage {
    return this.storage;
  }
  
  /**
   * Set a new storage instance
   * Useful for testing or switching storage implementations
   */
  setStorage(storage: IStorage): void {
    this.storage = storage;
  }
  
  /**
   * Execute a database read operation with optimization for read-heavy workloads
   * Uses read replicas and caching for improved performance
   */
  protected async executeReadQuery<T>(
    queryFunction: (db: typeof readDB) => Promise<T>,
    entityType: string,
    operation: string,
    identifier?: string | number,
    params?: Record<string, any>,
    cacheTtl: number = 300
  ): Promise<T> {
    const cacheKey = generateCacheKey(entityType, operation, identifier, params);
    return optimizedRead(queryFunction, cacheKey, cacheTtl);
  }
  
  /**
   * Execute a database write operation
   * Always uses the primary database and invalidates relevant cache entries
   */
  protected async executeWriteQuery<T>(
    writeFunction: (db: typeof primaryDB) => Promise<T>,
    invalidateCacheKeys: string[] = []
  ): Promise<T> {
    return optimizedWrite(writeFunction, invalidateCacheKeys);
  }
  
  /**
   * Generate a cache key for this service
   */
  protected generateCacheKey(
    operation: string,
    identifier?: string | number,
    params?: Record<string, any>
  ): string {
    // Extract service name without "Service" suffix for the entity type
    const serviceName = this.constructor.name.replace(/Service$/, '').toLowerCase();
    return generateCacheKey(serviceName, operation, identifier, params);
  }
  
  /**
   * Clear all cache entries for this service
   */
  public clearCache(): void {
    // Extract service name without "Service" suffix
    const serviceName = this.constructor.name.replace(/Service$/, '').toLowerCase();
    const keysToDelete = this.cache.keys().filter(key => key.startsWith(`db:${serviceName}:`));
    
    keysToDelete.forEach(key => this.cache.del(key));
    this.logger.debug(`Cache cleared for ${this.constructor.name}, ${keysToDelete.length} entries removed`);
  }
}