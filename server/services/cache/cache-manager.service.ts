/**
 * Cache Manager Service
 * High-performance caching layer with pattern-based invalidation
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export class CacheManager {
  private cache = new Map<string, { value: any; expiry: number }>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0
  };

  private readonly defaultTTL = 300; // 5 minutes
  private readonly maxSize = 100000; // Scale to 100k cache entries for large funds
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiryTime = Date.now() + (ttl || this.defaultTTL) * 1000;
    
    // Check cache size limit
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiry: expiryTime
    });

    this.stats.sets++;
  }

  /**
   * Delete specific key
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * Invalidate keys matching pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const regex = this.patternToRegex(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.stats.deletes++;
    }

    return keysToDelete.length;
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options?.ttl);
    return value;
  }

  /**
   * Batch get operations
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * Batch set operations
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys matching pattern
   */
  getKeysMatchingPattern(pattern: string): string[] {
    const regex = this.patternToRegex(pattern);
    const matchingKeys: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys;
  }

  /**
   * Set multiple keys with same TTL
   */
  async setMany<T>(data: Record<string, T>, ttl?: number): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Private helper methods
   */
  private patternToRegex(pattern: string): RegExp {
    // Convert glob-style pattern to regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.'); // Convert ? to .
    
    return new RegExp(`^${escaped}$`);
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  private evictOldest(): void {
    // Simple LRU: remove first (oldest) entry
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Singleton instance
export const cacheManager = new CacheManager();