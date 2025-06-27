/**
 * Optimized Routes with Pagination
 * 
 * High-performance API endpoints with cursor-based pagination
 * and optimized query patterns
 */

import { Router } from 'express';
import { OptimizedAllocationService } from './services/optimized-allocation.service';
import { CachingService } from './services/caching.service';

const router = Router();
const allocationService = new OptimizedAllocationService();
const cache = new CachingService();

/**
 * Paginated allocations endpoint with caching
 * Supports cursor-based pagination for large datasets
 */
router.get('/allocations/optimized', async (req, res) => {
  try {
    const { 
      cursor, 
      limit = 50, 
      fundId,
      includeMetrics = true 
    } = req.query;
    
    const cacheKey = `allocations:${fundId || 'all'}:${cursor || 'start'}:${limit}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        data: cached.data,
        nextCursor: cached.nextCursor,
        hasMore: cached.hasMore,
        cached: true
      });
    }
    
    // Fetch optimized data
    const allocations = await allocationService.getAllocationsWithContext(
      fundId ? Number(fundId) : undefined
    );
    
    // Apply pagination
    const startIndex = cursor ? parseInt(cursor as string) : 0;
    const endIndex = startIndex + Number(limit);
    const paginatedData = allocations.slice(startIndex, endIndex);
    const hasMore = endIndex < allocations.length;
    const nextCursor = hasMore ? endIndex.toString() : null;
    
    const result = {
      data: paginatedData,
      nextCursor,
      hasMore,
      total: allocations.length,
      cached: false
    };
    
    // Cache the result
    cache.set(cacheKey, result, 300); // 5 minute TTL
    
    res.json(result);
    
  } catch (error) {
    console.error('Optimized allocations endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch allocations' });
  }
});

/**
 * Optimized fund performance endpoint
 */
router.get('/funds/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `fund-performance:${id}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    
    const performance = await allocationService.getFundPerformanceMetrics(Number(id));
    
    if (!performance) {
      return res.status(404).json({ error: 'Fund not found' });
    }
    
    cache.set(cacheKey, performance, 600); // 10 minute TTL
    
    res.json({ ...performance, cached: false });
    
  } catch (error) {
    console.error('Fund performance endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch fund performance' });
  }
});

export default router;