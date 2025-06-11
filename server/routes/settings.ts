import express from 'express';
import { FUND_CONFIG } from '../config/fund-config.js';
import { SERVER_CONFIG } from '../config/server-config.js';

const router = express.Router();

/**
 * Get application settings for frontend configuration
 * This eliminates hardcoded values in the frontend by providing configurable settings
 */
router.get('/', (req, res) => {
  try {
    const settings = {
      // Fund and allocation settings
      fund: {
        maxCommitment: FUND_CONFIG.MAX_COMMITMENT,
        minCommitment: FUND_CONFIG.MIN_COMMITMENT,
        currencyStep: FUND_CONFIG.CURRENCY_STEP,
        percentagePrecision: FUND_CONFIG.PERCENTAGE_PRECISION,
        defaultCallDueDays: FUND_CONFIG.DEFAULT_CALL_DUE_DAYS,
        minCallDueDays: FUND_CONFIG.MIN_CALL_DUE_DAYS,
        maxCallDueDays: FUND_CONFIG.MAX_CALL_DUE_DAYS,
        maxPortfolioWeight: FUND_CONFIG.MAX_PORTFOLIO_WEIGHT,
        minAllocationAmount: FUND_CONFIG.MIN_ALLOCATION_AMOUNT,
        irrPrecision: FUND_CONFIG.IRR_CALCULATION_PRECISION,
        moicPrecision: FUND_CONFIG.MOIC_CALCULATION_PRECISION,
      },
      
      // UI configuration
      ui: {
        pageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '25', 10),
        maxFileSize: SERVER_CONFIG.MAX_FILE_SIZE,
        allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'
        ],
      },
      
      // Performance settings
      performance: {
        batchSize: FUND_CONFIG.BATCH_SIZE,
        recalcThrottleMs: FUND_CONFIG.RECALC_THROTTLE_MS,
      },
      
      // Environment info (for conditional UI features)
      environment: {
        isDevelopment: SERVER_CONFIG.NODE_ENV === 'development',
        isProduction: SERVER_CONFIG.NODE_ENV === 'production',
      },
    };

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch application settings' });
  }
});

export default router;