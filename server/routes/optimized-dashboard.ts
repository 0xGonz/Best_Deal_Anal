/**
 * Optimized Dashboard Routes
 * Uses performance optimization service for faster queries
 */

import express from 'express';
import PerformanceOptimizationService from '../services/performance-optimization.service';
import { requireAuth } from '../utils/auth';

const router = express.Router();
const performanceService = new PerformanceOptimizationService();

// Initialize cache warmup
performanceService.warmupCache().catch(console.error);

/**
 * GET /api/dashboard/stats - Optimized dashboard statistics
 */
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const stats = await performanceService.getOptimizedDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting optimized dashboard stats:', error);
    next(error);
  }
});

/**
 * GET /api/dashboard/performance - Performance metrics
 */
router.get('/performance', requireAuth, async (req, res) => {
  try {
    const cacheStats = performanceService.getCacheStats();
    
    res.json({
      cache: cacheStats,
      timestamp: new Date().toISOString(),
      optimizationsActive: true
    });
  } catch (error) {
    console.error('Error getting performance stats:', error);
    res.status(500).json({ error: 'Failed to get performance stats' });
  }
});

/**
 * POST /api/dashboard/cache/invalidate - Clear cache
 */
router.post('/cache/invalidate', requireAuth, async (req, res) => {
  try {
    const { pattern } = req.body;
    
    if (pattern) {
      performanceService.invalidateCache(pattern);
      res.json({ message: `Cache invalidated for pattern: ${pattern}` });
    } else {
      // Clear all dashboard cache
      performanceService.invalidateCache('dashboard');
      res.json({ message: 'Dashboard cache cleared' });
    }
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

export default router;