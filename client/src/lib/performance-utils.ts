/**
 * Frontend Performance Utilities
 * Implements retry logic, caching, and performance monitoring
 */

import { QueryClient } from '@tanstack/react-query';

interface RetryOptions {
  retries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

interface PerformanceMetrics {
  queryTime: number;
  cacheHit: boolean;
  retryCount: number;
  endpoint: string;
  timestamp: Date;
}

class PerformanceManager {
  private metrics: PerformanceMetrics[] = [];
  private static instance: PerformanceManager;

  static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  /**
   * Enhanced fetch with retry logic and exponential backoff
   */
  async fetchWithRetry(
    url: string, 
    options: RequestInit = {}, 
    retryOptions: RetryOptions = { retries: 3, retryDelay: 1000, backoffMultiplier: 2 }
  ): Promise<Response> {
    const startTime = Date.now();
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryOptions.retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });
        
        // Record successful query
        this.recordMetric({
          queryTime: Date.now() - startTime,
          cacheHit: false,
          retryCount: attempt,
          endpoint: url,
          timestamp: new Date()
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof TypeError && error.message.includes('AbortError')) {
          throw error;
        }
        
        if (attempt < retryOptions.retries) {
          const delay = retryOptions.retryDelay * Math.pow(retryOptions.backoffMultiplier, attempt);

          await this.delay(delay);
        }
      }
    }
    
    // Record failed query
    this.recordMetric({
      queryTime: Date.now() - startTime,
      cacheHit: false,
      retryCount: retryOptions.retries,
      endpoint: url,
      timestamp: new Date()
    });
    
    throw lastError!;
  }

  /**
   * Debounce function for expensive operations
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }

  /**
   * Throttle function for high-frequency events
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func.apply(null, args);
      }
    };
  }

  /**
   * Lazy loading component wrapper
   */
  lazyLoad<T extends React.ComponentType<any>>(
    componentImport: () => Promise<{ default: T }>
  ) {
    return React.lazy(componentImport);
  }

  /**
   * Virtual scrolling for large lists
   */
  useVirtualScroll(items: any[], itemHeight: number, containerHeight: number) {
    const [scrollTop, setScrollTop] = React.useState(0);
    
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    const visibleItems = items.slice(visibleStart, visibleEnd);
    const totalHeight = items.length * itemHeight;
    const offsetY = visibleStart * itemHeight;
    
    return {
      visibleItems,
      totalHeight,
      offsetY,
      setScrollTop
    };
  }

  /**
   * Memoization for expensive calculations
   */
  memoize<T extends (...args: any[]) => any>(func: T): T {
    const cache = new Map();
    
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = func.apply(null, args);
      cache.set(key, result);
      
      // Limit cache size
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return result;
    }) as T;
  }

  /**
   * Performance monitoring
   */
  getPerformanceStats() {
    if (this.metrics.length === 0) {
      return {
        averageQueryTime: 0,
        retryRate: 0,
        slowQueries: 0,
        totalQueries: 0
      };
    }

    const totalQueries = this.metrics.length;
    const averageQueryTime = this.metrics.reduce((sum, m) => sum + m.queryTime, 0) / totalQueries;
    const retriedQueries = this.metrics.filter(m => m.retryCount > 0).length;
    const retryRate = (retriedQueries / totalQueries) * 100;
    const slowQueries = this.metrics.filter(m => m.queryTime > 2000).length;

    return {
      averageQueryTime: Math.round(averageQueryTime),
      retryRate: Math.round(retryRate * 100) / 100,
      slowQueries,
      totalQueries
    };
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  cleanupMetrics() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }
}

// Enhanced query client configuration
export const createOptimizedQueryClient = (): QueryClient => {
  const performanceManager = PerformanceManager.getInstance();
  
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof Error && error.message.includes('4')) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
        networkMode: 'online',
      },
    },
  });
};

// React import for lazy loading
import React from 'react';

export default PerformanceManager;