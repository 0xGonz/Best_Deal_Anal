/**
 * Security middleware for request validation and protection
 */

import { Request, Response, NextFunction } from 'express';
import { StatusEnumService } from '../services/status-enum.service';

export class SecurityMiddleware {
  /**
   * Validate allocation status parameters
   */
  static validateAllocationStatus(req: Request, res: Response, next: NextFunction) {
    const { status } = req.body;
    
    if (status && !StatusEnumService.isValidAllocationStatus(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid allocation status',
        validStatuses: StatusEnumService.getAllAllocationStatuses()
      });
    }
    
    next();
  }

  /**
   * Validate capital call status parameters
   */
  static validateCapitalCallStatus(req: Request, res: Response, next: NextFunction) {
    const { status } = req.body;
    
    if (status && !StatusEnumService.isValidCapitalCallStatus(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid capital call status',
        validStatuses: StatusEnumService.getAllCapitalCallStatuses()
      });
    }
    
    next();
  }

  /**
   * Validate deal stage parameters
   */
  static validateDealStage(req: Request, res: Response, next: NextFunction) {
    const { stage } = req.body;
    
    if (stage && !StatusEnumService.isValidDealStage(stage)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid deal stage',
        validStages: StatusEnumService.getAllDealStages()
      });
    }
    
    next();
  }

  /**
   * Sanitize numeric inputs
   */
  static sanitizeNumericInputs(req: Request, res: Response, next: NextFunction) {
    const numericFields = ['amount', 'paidAmount', 'targetAmount', 'actualAmount'];
    
    for (const field of numericFields) {
      if (req.body[field] !== undefined) {
        const value = parseFloat(req.body[field]);
        if (isNaN(value) || value < 0) {
          return res.status(400).json({
            status: 'error',
            message: `Invalid ${field}: must be a non-negative number`
          });
        }
        req.body[field] = value;
      }
    }
    
    next();
  }

  /**
   * Rate limiting for sensitive operations
   */
  static rateLimitSensitiveOps(req: Request, res: Response, next: NextFunction) {
    // Simple in-memory rate limiting (for production, use Redis)
    const clientIP = req.ip;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 30; // Max 30 requests per minute
    
    if (!SecurityMiddleware.rateLimitStore) {
      SecurityMiddleware.rateLimitStore = new Map();
    }
    
    const clientData = SecurityMiddleware.rateLimitStore.get(clientIP) || { count: 0, windowStart: now };
    
    if (now - clientData.windowStart > windowMs) {
      // Reset window
      clientData.count = 1;
      clientData.windowStart = now;
    } else {
      clientData.count++;
    }
    
    SecurityMiddleware.rateLimitStore.set(clientIP, clientData);
    
    if (clientData.count > maxRequests) {
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((windowMs - (now - clientData.windowStart)) / 1000)
      });
    }
    
    next();
  }

  private static rateLimitStore: Map<string, { count: number; windowStart: number }>;
}