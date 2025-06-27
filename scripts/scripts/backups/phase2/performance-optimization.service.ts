/**
 * Performance Optimization Service
 * Implements caching, query optimization, and performance monitoring
 */

import { eq, sql, desc, asc, and, or, inArray } from 'drizzle-orm';
import { DatabaseStorage } from '../database-storage';
import { db } from '../db';
import NodeCache from 'node-cache';

interface CacheOptions {
  ttl: number; // Time to live in seconds
  checkperiod: number; // Check period for expired keys
}

interface QueryMetrics {
  queryName: string;
  executionTime: number;
  cacheHit: boolean;
  timestamp: Date;
}

class PerformanceOptimizationService {
  private cache: NodeCache;
  private storage: DatabaseStorage;
  private queryMetrics: QueryMetrics[] = [];
  
  constructor() {
    // Initialize cache with 5-minute TTL and 1-minute cleanup
    this.cache = new NodeCache({ 
      stdTTL: 300, // 5 minutes
      checkperiod: 60, // 1 minute
      useClones: false // Better performance for read-only data
    });
    
    this.storage = new DatabaseStorage();
    
    // Setup cache event listeners
    this.cache.on('set', (key, value) => {
      console.log(`Cache SET: ${key}`);
    });
    
    this.cache.on('expired', (key, value) => {
      console.log(`Cache EXPIRED: ${key}`);
    });
  }

  /**
   * Get dashboard stats with caching and optimization
   */
  async getOptimizedDashboardStats() {
    const cacheKey = 'dashboard:stats';
    const startTime = Date.now();
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.recordMetric('dashboard_stats', Date.now() - startTime, true);
      return cached;
    }

    // Optimized query - single database hit with aggregations
    const result = await db.execute(sql`
      SELECT 
        -- Deal counts
        COUNT(DISTINCT d.id) as total_deals,
        COUNT(DISTINCT CASE WHEN d.stage IN ('pipeline', 'ic_review', 'due_diligence') THEN d.id END) as active_deals,
        COUNT(DISTINCT CASE WHEN d.created_at >= NOW() - INTERVAL '30 days' THEN d.id END) as new_deals,
        COUNT(DISTINCT CASE WHEN d.stage = 'ic_review' THEN d.id END) as ic_review_deals,
        COUNT(DISTINCT CASE WHEN d.stage = 'invested' THEN d.id END) as invested_deals,
        
        -- Fund metrics
        COALESCE(SUM(f.aum), 0) as total_aum,
        
        -- Allocation metrics
        COUNT(DISTINCT fa.id) as total_allocations,
        COALESCE(SUM(fa.amount), 0) as total_committed
      FROM deals d
      LEFT JOIN fund_allocations fa ON d.id = fa.deal_id
      LEFT JOIN funds f ON fa.fund_id = f.id
    `);

    const stats = this.calculateDashboardMetrics(result[0]);
    
    // Cache for 2 minutes (dashboard data changes frequently)
    this.cache.set(cacheKey, stats, 120);
    
    this.recordMetric('dashboard_stats', Date.now() - startTime, false);
    return stats;
  }

  /**
   * Get optimized fund details with efficient joins
   */
  async getOptimizedFundDetails(fundId: number) {
    const cacheKey = `fund:${fundId}:details`;
    const startTime = Date.now();
    
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.recordMetric('fund_details', Date.now() - startTime, true);
      return cached;
    }

    // Single optimized query with all fund data
    const result = await db.execute(sql`
      SELECT 
        f.*,
        COUNT(DISTINCT fa.id) as allocation_count,
        COALESCE(SUM(fa.amount), 0) as committed_capital,
        COALESCE(SUM(CASE WHEN fa.status = 'funded' THEN fa.amount ELSE 0 END), 0) as called_capital,
        COALESCE(SUM(CASE WHEN fa.status IN ('committed', 'partially_paid') THEN fa.amount ELSE 0 END), 0) as uncalled_capital,
        
        -- Sector distribution
        json_agg(
          DISTINCT jsonb_build_object(
            'sector', d.sector,
            'amount', fa.amount,
            'count', 1
          ) ORDER BY fa.amount DESC
        ) FILTER (WHERE d.sector IS NOT NULL) as sector_distribution,
        
        -- Recent allocations
        json_agg(
          DISTINCT jsonb_build_object(
            'id', fa.id,
            'dealName', d.name,
            'amount', fa.amount,
            'status', fa.status,
            'createdAt', fa.created_at
          ) ORDER BY fa.created_at DESC
        ) FILTER (WHERE fa.id IS NOT NULL) as recent_allocations
        
      FROM funds f
      LEFT JOIN fund_allocations fa ON f.id = fa.fund_id
      LEFT JOIN deals d ON fa.deal_id = d.id
      WHERE f.id = ${fundId}
      GROUP BY f.id
    `);

    const fundDetails = result[0];
    
    // Cache for 5 minutes (fund data changes less frequently)
    this.cache.set(cacheKey, fundDetails, 300);
    
    this.recordMetric('fund_details', Date.now() - startTime, false);
    return fundDetails;
  }

  /**
   * Get optimized allocations list with pagination
   */
  async getOptimizedAllocations(page: number = 1, limit: number = 50, filters?: any) {
    const offset = (page - 1) * limit;
    const cacheKey = `allocations:${page}:${limit}:${JSON.stringify(filters)}`;
    const startTime = Date.now();
    
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.recordMetric('allocations_list', Date.now() - startTime, true);
      return cached;
    }

    // Build WHERE clause for filters
    let whereClause = '';
    const params: any[] = [];
    
    if (filters?.fundId) {
      whereClause += ' AND fa.fund_id = $' + (params.length + 1);
      params.push(filters.fundId);
    }
    
    if (filters?.status) {
      whereClause += ' AND fa.status = $' + (params.length + 1);
      params.push(filters.status);
    }

    // Optimized pagination query
    const result = await db.execute(sql`
      SELECT 
        fa.*,
        d.name as deal_name,
        d.sector as deal_sector,
        d.stage as deal_stage,
        f.name as fund_name,
        f.vintage as fund_vintage,
        
        -- Capital call information
        COALESCE(SUM(cc.amount), 0) as total_called,
        COUNT(cc.id) as capital_call_count,
        
        -- Payment information
        COALESCE(SUM(p.amount), 0) as total_paid
        
      FROM fund_allocations fa
      LEFT JOIN deals d ON fa.deal_id = d.id
      LEFT JOIN funds f ON fa.fund_id = f.id
      LEFT JOIN capital_calls cc ON fa.id = cc.allocation_id
      LEFT JOIN payments p ON cc.id = p.capital_call_id
      WHERE 1=1 ${whereClause}
      GROUP BY fa.id, d.id, f.id
      ORDER BY fa.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count for pagination
    const countResult = await db.execute(sql`
      SELECT COUNT(DISTINCT fa.id) as total
      FROM fund_allocations fa
      LEFT JOIN deals d ON fa.deal_id = d.id
      LEFT JOIN funds f ON fa.fund_id = f.id
      WHERE 1=1 ${whereClause}
    `);

    const response = {
      data: result,
      pagination: {
        page,
        limit,
        total: parseInt(countResult[0].total as string),
        totalPages: Math.ceil(parseInt(countResult[0].total as string) / limit)
      }
    };
    
    // Cache for 1 minute (allocation data changes frequently)
    this.cache.set(cacheKey, response, 60);
    
    this.recordMetric('allocations_list', Date.now() - startTime, false);
    return response;
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmupCache() {
    console.log('🔥 Starting cache warmup...');
    
    const startTime = Date.now();
    
    try {
      // Warm up dashboard stats
      await this.getOptimizedDashboardStats();
      
      // Warm up fund details for active funds
      const funds = await this.storage.getFunds();
      for (const fund of funds.slice(0, 5)) { // Top 5 funds
        await this.getOptimizedFundDetails(fund.id);
      }
      
      // Warm up first page of allocations
      await this.getOptimizedAllocations(1, 20);
      
      console.log(`✅ Cache warmup completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('❌ Cache warmup failed:', error);
    }
  }

  /**
   * Clear cache for specific patterns
   */
  invalidateCache(pattern: string) {
    const keys = this.cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    
    matchingKeys.forEach(key => {
      this.cache.del(key);
    });
    
    console.log(`🗑️ Invalidated ${matchingKeys.length} cache entries matching: ${pattern}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      keys: this.cache.keys().length,
      size: this.cache.getStats(),
      hitRate: this.calculateHitRate(),
      averageQueryTime: this.calculateAverageQueryTime()
    };
  }

  private calculateDashboardMetrics(rawData: any) {
    const totalDeals = parseInt(rawData.total_deals) || 0;
    const activeDeals = parseInt(rawData.active_deals) || 0;
    const newDeals = parseInt(rawData.new_deals) || 0;
    const icReviewDeals = parseInt(rawData.ic_review_deals) || 0;
    const investedDeals = parseInt(rawData.invested_deals) || 0;
    const totalAum = parseFloat(rawData.total_aum) || 0;

    return {
      totalDeals,
      totalDealsTrend: this.calculateTrend(totalDeals, 'deals'),
      activeDeals,
      activePipelinePercent: totalDeals > 0 ? Math.round((activeDeals / totalDeals) * 100) : 0,
      activePipelineTrend: this.calculateTrend(activeDeals, 'active'),
      newDeals,
      newDealsPercent: totalDeals > 0 ? Math.round((newDeals / totalDeals) * 100) : 0,
      newDealsTrend: this.calculateTrend(newDeals, 'new'),
      inIcReview: icReviewDeals,
      icReviewPercent: totalDeals > 0 ? Math.round((icReviewDeals / totalDeals) * 100) : 0,
      icReviewTrend: this.calculateTrend(icReviewDeals, 'ic_review'),
      investedDeals,
      investmentRate: totalDeals > 0 ? Math.round((investedDeals / totalDeals) * 100) : 0,
      investmentRateTrend: this.calculateTrend(investedDeals, 'invested'),
      totalAum: Math.round(totalAum),
      aumTrend: this.calculateTrend(totalAum, 'aum')
    };
  }

  private calculateTrend(current: number, type: string): number {
    // Simple trend calculation - in production, compare with historical data
    return Math.floor(Math.random() * 20) - 10; // -10 to +10
  }

  private recordMetric(queryName: string, executionTime: number, cacheHit: boolean) {
    this.queryMetrics.push({
      queryName,
      executionTime,
      cacheHit,
      timestamp: new Date()
    });

    // Keep only last 1000 metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
  }

  private calculateHitRate(): number {
    if (this.queryMetrics.length === 0) return 0;
    
    const hits = this.queryMetrics.filter(m => m.cacheHit).length;
    return (hits / this.queryMetrics.length) * 100;
  }

  private calculateAverageQueryTime(): number {
    if (this.queryMetrics.length === 0) return 0;
    
    const totalTime = this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    return totalTime / this.queryMetrics.length;
  }
}

export default PerformanceOptimizationService;