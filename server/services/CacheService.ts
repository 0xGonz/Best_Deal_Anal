import NodeCache from 'node-cache';

/**
 * CacheService provides a memory-based caching layer
 * that can be used to reduce database load for frequently accessed data
 */
export class CacheService {
  private static instance: CacheService;
  private cache: NodeCache;
  
  // Cache TTL settings (in seconds)
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly SHORT_TTL = 60; // 1 minute
  private static readonly LONG_TTL = 3600; // 1 hour
  
  // Cache key prefixes for different entity types
  private static readonly KEY_PREFIXES = {
    USER: 'user:',
    DEAL: 'deal:',
    FUND: 'fund:',
    DEALS_LIST: 'deals:list',
    FUNDS_LIST: 'funds:list',
    USERS_LIST: 'users:list',
    TIMELINE: 'timeline:',
  };
  
  constructor() {
    // Initialize the cache with standard settings
    this.cache = new NodeCache({
      stdTTL: CacheService.DEFAULT_TTL,
      checkperiod: 60, // Check for expired keys every minute
      useClones: false, // Store references to objects instead of clones for better performance
      deleteOnExpire: true // Automatically delete expired items
    });
    
    // Set up cache statistics logging
    setInterval(() => {
      const stats = this.cache.getStats();
      console.log(`Cache stats: ${stats.keys} keys, ${stats.hits} hits, ${stats.misses} misses, hit rate: ${stats.hits / (stats.hits + stats.misses || 1) * 100}%`);
    }, 3600000); // Log cache statistics hourly
  }
  
  /**
   * Get the singleton instance of the cache service
   */
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }
  
  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached value or undefined if not found
   */
  public get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }
  
  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Optional TTL in seconds, defaults to the cache's standard TTL
   * @returns True if the value was set successfully
   */
  public set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || undefined);
  }
  
  /**
   * Delete a value from the cache
   * @param key The cache key
   * @returns True if the key was found and deleted
   */
  public del(key: string): number {
    return this.cache.del(key);
  }
  
  /**
   * Flush all cached data
   */
  public flush(): void {
    this.cache.flushAll();
  }
  
  /**
   * Get all keys in the cache
   * @returns Array of all cache keys
   */
  public keys(): string[] {
    return this.cache.keys();
  }
  
  /**
   * Invalidate all keys with a certain prefix
   * @param prefix The key prefix to invalidate
   */
  public invalidateByPrefix(prefix: string): void {
    const keys = this.cache.keys().filter(key => key.startsWith(prefix));
    this.cache.del(keys);
  }
  
  /**
   * Get a user from cache or execute the provided function to fetch it
   * @param id The user ID
   * @param fetchFn Function to fetch the user if not in cache
   */
  public async getUser<T>(id: number, fetchFn: () => Promise<T>): Promise<T> {
    const key = `${CacheService.KEY_PREFIXES.USER}${id}`;
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const data = await fetchFn();
    if (data) {
      this.set(key, data);
    }
    return data;
  }
  
  /**
   * Get a deal from cache or execute the provided function to fetch it
   * @param id The deal ID
   * @param fetchFn Function to fetch the deal if not in cache
   */
  public async getDeal<T>(id: number, fetchFn: () => Promise<T>): Promise<T> {
    const key = `${CacheService.KEY_PREFIXES.DEAL}${id}`;
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const data = await fetchFn();
    if (data) {
      this.set(key, data);
    }
    return data;
  }
  
  /**
   * Get a fund from cache or execute the provided function to fetch it
   * @param id The fund ID
   * @param fetchFn Function to fetch the fund if not in cache
   */
  public async getFund<T>(id: number, fetchFn: () => Promise<T>): Promise<T> {
    const key = `${CacheService.KEY_PREFIXES.FUND}${id}`;
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const data = await fetchFn();
    if (data) {
      this.set(key, data);
    }
    return data;
  }
  
  /**
   * Get all deals from cache or execute the provided function to fetch them
   * @param fetchFn Function to fetch all deals if not in cache
   */
  public async getAllDeals<T>(fetchFn: () => Promise<T>): Promise<T> {
    const key = CacheService.KEY_PREFIXES.DEALS_LIST;
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const data = await fetchFn();
    if (data) {
      this.set(key, data, CacheService.SHORT_TTL); // Shorter TTL for lists as they change more frequently
    }
    return data;
  }
  
  /**
   * Get all funds from cache or execute the provided function to fetch them
   * @param fetchFn Function to fetch all funds if not in cache
   */
  public async getAllFunds<T>(fetchFn: () => Promise<T>): Promise<T> {
    const key = CacheService.KEY_PREFIXES.FUNDS_LIST;
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const data = await fetchFn();
    if (data) {
      this.set(key, data, CacheService.SHORT_TTL);
    }
    return data;
  }
  
  /**
   * Get timeline events for a deal from cache or execute the provided function to fetch them
   * @param dealId The deal ID
   * @param fetchFn Function to fetch timeline events if not in cache
   */
  public async getTimelineEvents<T>(dealId: number, fetchFn: () => Promise<T>): Promise<T> {
    const key = `${CacheService.KEY_PREFIXES.TIMELINE}${dealId}`;
    const cached = this.get<T>(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const data = await fetchFn();
    if (data) {
      this.set(key, data, CacheService.SHORT_TTL);
    }
    return data;
  }
  
  /**
   * Invalidate user cache
   * @param userId The user ID to invalidate, or all users if not provided
   */
  public invalidateUserCache(userId?: number): void {
    if (userId) {
      this.del(`${CacheService.KEY_PREFIXES.USER}${userId}`);
    } else {
      this.invalidateByPrefix(CacheService.KEY_PREFIXES.USER);
      this.del(CacheService.KEY_PREFIXES.USERS_LIST);
    }
  }
  
  /**
   * Invalidate deal cache
   * @param dealId The deal ID to invalidate, or all deals if not provided
   */
  public invalidateDealCache(dealId?: number): void {
    if (dealId) {
      this.del(`${CacheService.KEY_PREFIXES.DEAL}${dealId}`);
      this.del(`${CacheService.KEY_PREFIXES.TIMELINE}${dealId}`);
    } else {
      this.invalidateByPrefix(CacheService.KEY_PREFIXES.DEAL);
      this.invalidateByPrefix(CacheService.KEY_PREFIXES.TIMELINE);
      this.del(CacheService.KEY_PREFIXES.DEALS_LIST);
    }
  }
  
  /**
   * Invalidate fund cache
   * @param fundId The fund ID to invalidate, or all funds if not provided
   */
  public invalidateFundCache(fundId?: number): void {
    if (fundId) {
      this.del(`${CacheService.KEY_PREFIXES.FUND}${fundId}`);
    } else {
      this.invalidateByPrefix(CacheService.KEY_PREFIXES.FUND);
      this.del(CacheService.KEY_PREFIXES.FUNDS_LIST);
    }
  }
}