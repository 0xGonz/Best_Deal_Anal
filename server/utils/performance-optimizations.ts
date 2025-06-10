/**
 * Database performance optimization utilities
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export class PerformanceOptimizer {
  /**
   * Add missing database indexes for common queries
   */
  static async addCriticalIndexes() {
    const indexes = [
      // User authentication queries
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username)`,
      
      // Deal filtering and search
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_stage ON deals(stage)`,
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_created_at ON deals("createdAt")`,
      
      // Fund allocation queries
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fund_allocations_fund_id ON fund_allocations(fund_id)`,
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fund_allocations_deal_id ON fund_allocations(deal_id)`,
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fund_allocations_status ON fund_allocations(status)`,
      
      // Capital calls optimization
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capital_calls_due_date ON capital_calls(due_date)`,
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capital_calls_status ON capital_calls(status)`,
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capital_calls_allocation_id ON capital_calls(allocation_id)`,
      
      // Session store optimization
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_expire ON session(expire)`,
      
      // Timeline and activities
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_deal_id ON timeline_events(deal_id)`,
      sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_date ON timeline_events(date)`,
    ];

    const results = [];
    for (const indexQuery of indexes) {
      try {
        await db.execute(indexQuery);
        results.push({ success: true, query: 'index created' });
      } catch (error) {
        results.push({ success: false, query: 'index failed', error: (error as Error).message });
      }
    }
    
    return results;
  }

  /**
   * Optimize connection pool settings
   */
  static getOptimizedPoolConfig() {
    return {
      max: 20, // Maximum number of connections
      min: 2,  // Minimum number of connections
      acquire: 30000, // Maximum time (ms) to try getting connection
      idle: 10000,    // Maximum time (ms) a connection can be idle
      evict: 1000,    // Time interval (ms) to run eviction
      handleDisconnects: true,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    };
  }

  /**
   * Clean up stale sessions and expired data
   */
  static async performMaintenanceCleanup() {
    const cleanupQueries = [
      // Remove expired sessions
      sql`DELETE FROM session WHERE expire < NOW()`,
      
      // Clean up old notifications (older than 30 days)
      sql`DELETE FROM notifications WHERE "createdAt" < NOW() - INTERVAL '30 days' AND read = true`,
      
      // Archive old timeline events (older than 1 year)
      sql`UPDATE timeline_events SET archived = true WHERE date < NOW() - INTERVAL '1 year' AND archived = false`,
    ];

    const results = [];
    for (const cleanupQuery of cleanupQueries) {
      try {
        const result = await db.execute(cleanupQuery);
        results.push({ 
          success: true, 
          query: 'cache cleanup',
          rowsAffected: result.rowCount || 0
        });
      } catch (error) {
        results.push({ 
          success: false, 
          query: 'cache cleanup failed', 
          error: (error as Error).message 
        });
      }
    }
    
    return results;
  }
}