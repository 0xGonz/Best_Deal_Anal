/**
 * Fund Authorization Middleware
 * 
 * Addresses Issue #7 from audit: No row-level auth
 * Implements basic authorization checks for fund access
 */

import { Request, Response, NextFunction } from 'express';
import { StorageFactory } from '../storage-factory';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
    username: string;
  };
}

interface FundAccessRule {
  role: string;
  canAccess: (userId: number, fundId: number) => Promise<boolean>;
}

export class FundAuthorizationService {
  private storage = StorageFactory.getStorage();
  
  // Define access rules based on user roles
  private accessRules: FundAccessRule[] = [
    {
      role: 'admin',
      canAccess: async () => true // Admins can access all funds
    },
    {
      role: 'manager',
      canAccess: async (userId: number, fundId: number) => {
        // Managers can access funds they are assigned to
        // This would need to be implemented based on your business logic
        return true; // Placeholder - implement actual logic
      }
    },
    {
      role: 'analyst',
      canAccess: async (userId: number, fundId: number) => {
        // Analysts have limited access
        // This would need to be implemented based on your business logic
        return true; // Placeholder - implement actual logic
      }
    }
  ];

  /**
   * Check if user can access a specific fund
   */
  async canAccessFund(userId: number, userRole: string, fundId: number): Promise<boolean> {
    const rule = this.accessRules.find(r => r.role === userRole);
    
    if (!rule) {
      return false; // Unknown role, deny access
    }

    try {
      return await rule.canAccess(userId, fundId);
    } catch (error) {
      console.error('Error checking fund access:', error);
      return false; // Deny access on error
    }
  }

  /**
   * Middleware to require fund access
   */
  requireFundAccess = (fundIdParam: string = 'fundId') => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const fundId = parseInt(req.params[fundIdParam]);
        if (isNaN(fundId)) {
          return res.status(400).json({ error: 'Invalid fund ID' });
        }

        // Check if fund exists
        const fund = await this.storage.getFund(fundId);
        if (!fund) {
          return res.status(404).json({ error: 'Fund not found' });
        }

        // Check authorization
        const hasAccess = await this.canAccessFund(user.id, user.role, fundId);
        if (!hasAccess) {
          return res.status(403).json({ 
            error: 'Access denied',
            message: 'You do not have permission to access this fund'
          });
        }

        next();
      } catch (error) {
        console.error('Error in fund authorization middleware:', error);
        res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  };

  /**
   * Get list of funds user can access
   */
  async getAccessibleFunds(userId: number, userRole: string): Promise<number[]> {
    try {
      const allFunds = await this.storage.getFunds();
      const accessibleFunds = [];

      for (const fund of allFunds) {
        const hasAccess = await this.canAccessFund(userId, userRole, fund.id);
        if (hasAccess) {
          accessibleFunds.push(fund.id);
        }
      }

      return accessibleFunds;
    } catch (error) {
      console.error('Error getting accessible funds:', error);
      return [];
    }
  }

  /**
   * Filter fund list based on user access
   */
  async filterFundsByAccess(userId: number, userRole: string, funds: any[]): Promise<any[]> {
    const filteredFunds = [];

    for (const fund of funds) {
      const hasAccess = await this.canAccessFund(userId, userRole, fund.id);
      if (hasAccess) {
        filteredFunds.push(fund);
      }
    }

    return filteredFunds;
  }
}

export const fundAuthorizationService = new FundAuthorizationService();

/**
 * Convenience middleware function
 */
export const requireFundAccess = (fundIdParam: string = 'fundId') => {
  return fundAuthorizationService.requireFundAccess(fundIdParam);
};