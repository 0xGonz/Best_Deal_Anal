/**
 * Sync Routes
 * 
 * Provides endpoints for manual data synchronization and integrity validation
 * Addresses the committed/paid/funded drift issues
 */

import express from 'express';
import { requireAuth } from '../utils/auth';
import { requirePermission } from '../utils/permissions';
import AllocationSyncService from '../services/allocation-sync.service';

const router = express.Router();

// Sync single allocation
router.post('/allocation/:id', requireAuth, requirePermission('edit', 'allocation'), async (req, res) => {
  try {
    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    const result = await AllocationSyncService.syncAllocation(allocationId);
    
    res.json({
      message: result.synced ? 'Allocation synced successfully' : 'Allocation was already in sync',
      result
    });
  } catch (error) {
    console.error('Error syncing allocation:', error);
    res.status(500).json({ error: 'Failed to sync allocation' });
  }
});

// Sync all allocations for a fund
router.post('/fund/:id', requireAuth, requirePermission('edit', 'fund'), async (req, res) => {
  try {
    const fundId = parseInt(req.params.id);
    if (isNaN(fundId)) {
      return res.status(400).json({ error: 'Invalid fund ID' });
    }

    const results = await AllocationSyncService.syncFundAllocations(fundId);
    const syncedCount = results.filter(r => r.synced).length;
    const errorCount = results.filter(r => r.error).length;
    
    res.json({
      message: `Synced ${syncedCount} allocations for fund ${fundId}`,
      syncedCount,
      errorCount,
      totalAllocations: results.length,
      results
    });
  } catch (error) {
    console.error('Error syncing fund allocations:', error);
    res.status(500).json({ error: 'Failed to sync fund allocations' });
  }
});

// Sync all allocations in the system
router.post('/all', requireAuth, requirePermission('admin', 'system'), async (req, res) => {
  try {
    const result = await AllocationSyncService.syncAllAllocations();
    
    res.json({
      message: `System sync completed. ${result.syncedAllocations}/${result.totalAllocations} allocations synced`,
      ...result
    });
  } catch (error) {
    console.error('Error syncing all allocations:', error);
    res.status(500).json({ error: 'Failed to sync all allocations' });
  }
});

// Validate allocation integrity
router.get('/validate/:id', requireAuth, async (req, res) => {
  try {
    const allocationId = parseInt(req.params.id);
    if (isNaN(allocationId)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    const validation = await AllocationSyncService.validateAllocationIntegrity(allocationId);
    
    res.json({
      message: validation.isValid ? 'Allocation data is consistent' : 'Data inconsistencies found',
      ...validation
    });
  } catch (error) {
    console.error('Error validating allocation:', error);
    res.status(500).json({ error: 'Failed to validate allocation' });
  }
});

// Get sync status for all allocations
router.get('/status', requireAuth, async (req, res) => {
  try {
    // This would require implementing a status check method
    res.json({
      message: 'Sync status endpoint - implementation in progress',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

export default router;