/**
 * High-Performance Caching Service
 * 
 * In-memory caching with TTL support for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
  hits: number;
}

export class CachingService {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 1000;
  private defaultTTL = 300; // 5 minutes

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    // Increment hit counter
    entry.hits++;
    
    return entry.data;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds || this.defaultTTL;
    const expiry = Date.now() + (ttl * 1000);
    
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      data,
      expiry,
      hits: 0
    });
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear cache by pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const expired = entries.filter(entry => Date.now() > entry.expiry).length;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      expired,
      hitRate: entries.length > 0 ? totalHits / entries.length : 0
    };
  }

  /**
   * Evict oldest entries based on hits
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by hits (ascending) and expiry
    entries.sort((a, b) => {
      if (a[1].hits !== b[1].hits) {
        return a[1].hits - b[1].hits;
      }
      return a[1].expiry - b[1].expiry;
    });
    
    // Remove oldest 25% of entries
    const removeCount = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < removeCount; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
}