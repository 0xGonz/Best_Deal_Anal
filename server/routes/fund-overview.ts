/**
 * Fund Overview API - Single Source of Truth
 * Provides comprehensive fund metrics calculated at database level
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../utils/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/fund-overview/:fundId - Get comprehensive fund metrics
 * Returns all calculated metrics from database view to eliminate multiple calculation layers
 */
router.get('/:fundId', requireAuth, async (req: Request, res: Response) => {
  try {
    const fundId = parseInt(req.params.fundId);
    if (isNaN(fundId)) {
      return res.status(400).json({ error: 'Invalid fund ID' });
    }

    const result = await db.execute(sql`
      SELECT 
        fund_id as "fundId",
        fund_name as "fundName", 
        target_size as "targetSize",
        vintage,
        aum,
        committed,
        called,
        uncalled,
        weight_pct as "weightPct",
        allocation_count as "allocationCount",
        total_paid as "totalPaid",
        total_market_value as "totalMarketValue",
        portfolio_moic as "portfolioMoic",
        total_interest_paid as "totalInterestPaid",
        total_distribution_paid as "totalDistributionPaid"
      FROM vw_fund_overview 
      WHERE fund_id = ${fundId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fund not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error getting fund overview:', error);
    res.status(500).json({
      error: 'Failed to get fund overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/fund-overview - Get all funds overview
 * Returns metrics for all funds
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        fund_id as "fundId",
        fund_name as "fundName", 
        target_size as "targetSize",
        vintage,
        aum,
        committed,
        called,
        uncalled,
        weight_pct as "weightPct",
        allocation_count as "allocationCount",
        total_paid as "totalPaid",
        total_market_value as "totalMarketValue",
        portfolio_moic as "portfolioMoic",
        total_interest_paid as "totalInterestPaid",
        total_distribution_paid as "totalDistributionPaid"
      FROM vw_fund_overview 
      ORDER BY fund_name
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Error getting funds overview:', error);
    res.status(500).json({
      error: 'Failed to get funds overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;