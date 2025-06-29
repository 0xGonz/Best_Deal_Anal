/**
 * Multi-Tenant Security Middleware
 * 
 * Implements org-level isolation to prevent cross-tenant data access.
 * Addresses Issue #10 from performance audit - No multi-tenant hardening.
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

interface TenantUser {
  id: number;
  username: string;
  role: string;
  orgId?: number;
  permissions: string[];
}

// Extended request type with tenant context
export interface TenantRequest extends Request {
  user?: TenantUser;
  orgId?: number;
  tenantContext?: {
    orgId: number;
    canAccessAllOrgs: boolean;
    restrictedFunds: number[];
  };
}

// Initialize org isolation table
export async function initializeOrgTables() {
  try {
    // Add org_id to users table if it doesn't exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS org_id INTEGER DEFAULT 1;
      
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT true
      );
      
      -- Insert default organization if none exists
      INSERT INTO organizations (id, name, domain) 
      VALUES (1, 'Default Organization', 'localhost')
      ON CONFLICT (id) DO NOTHING;
      
      -- Add foreign key constraint
      ALTER TABLE users 
      ADD CONSTRAINT fk_users_org_id 
      FOREIGN KEY (org_id) REFERENCES organizations(id)
      ON DELETE SET DEFAULT;
      
      -- Add org_id to key tables
      ALTER TABLE funds ADD COLUMN IF NOT EXISTS org_id INTEGER DEFAULT 1;
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS org_id INTEGER DEFAULT 1;
      ALTER TABLE fund_allocations ADD COLUMN IF NOT EXISTS org_id INTEGER DEFAULT 1;
      ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS org_id INTEGER DEFAULT 1;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS org_id INTEGER DEFAULT 1;
      
      -- Add indexes for org-based queries
      CREATE INDEX IF NOT EXISTS idx_funds_org_id ON funds(org_id);
      CREATE INDEX IF NOT EXISTS idx_deals_org_id ON deals(org_id);
      CREATE INDEX IF NOT EXISTS idx_fund_allocations_org_id ON fund_allocations(org_id);
      CREATE INDEX IF NOT EXISTS idx_capital_calls_org_id ON capital_calls(org_id);
      CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);
      
      -- Update existing records to belong to default org
      UPDATE users SET org_id = 1 WHERE org_id IS NULL;
      UPDATE funds SET org_id = 1 WHERE org_id IS NULL;
      UPDATE deals SET org_id = 1 WHERE org_id IS NULL;
      UPDATE fund_allocations SET org_id = 1 WHERE org_id IS NULL;
      UPDATE capital_calls SET org_id = 1 WHERE org_id IS NULL;
      UPDATE documents SET org_id = 1 WHERE org_id IS NULL;
    `);
    
    console.log('✅ Organization isolation tables initialized');
  } catch (error) {
    console.error('Failed to initialize org tables:', error);
  }
}

// Middleware to enforce tenant isolation
export const tenantIsolationMiddleware = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    // Skip for auth and system endpoints
    const skipPaths = ['/auth', '/system', '/health'];
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Only apply tenant isolation to API routes
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    if (!req.user?.id) {
      return next(); // Let the auth middleware handle this
    }

    // Get user's org context
    const userResult = await pool.query(
      `SELECT u.id, u.username, u.role, u.org_id, o.name as org_name
       FROM users u 
       LEFT JOIN organizations o ON u.org_id = o.id 
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'User organization not found' });
    }

    const userData = userResult.rows[0];
    req.orgId = userData.org_id || 1;
    
    // Set tenant context
    req.tenantContext = {
      orgId: req.orgId,
      canAccessAllOrgs: userData.role === 'admin' && process.env.ALLOW_CROSS_ORG === 'true',
      restrictedFunds: [] // Can be populated with fund-specific restrictions
    };

    // Add org context to request for downstream use
    req.user = {
      ...req.user,
      orgId: req.orgId
    };

    next();
  } catch (error) {
    console.error('Tenant isolation middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to add org filter to queries
export function addOrgFilter(baseQuery: string, orgId: number, tableName: string = 't'): string {
  if (baseQuery.toLowerCase().includes('where')) {
    return `${baseQuery} AND ${tableName}.org_id = ${orgId}`;
  } else {
    return `${baseQuery} WHERE ${tableName}.org_id = ${orgId}`;
  }
}

// Middleware to validate resource ownership
export const validateResourceOwnership = (resourceType: 'fund' | 'deal' | 'allocation' | 'document') => {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const resourceId = req.params.id || req.params.fundId || req.params.dealId;
      if (!resourceId || !req.orgId) {
        return next();
      }

      let tableName = '';
      let idField = 'id';
      
      switch (resourceType) {
        case 'fund':
          tableName = 'funds';
          break;
        case 'deal':
          tableName = 'deals';
          break;
        case 'allocation':
          tableName = 'fund_allocations';
          break;
        case 'document':
          tableName = 'documents';
          break;
      }

      const result = await pool.query(
        `SELECT org_id FROM ${tableName} WHERE ${idField} = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `${resourceType} not found` });
      }

      const resourceOrgId = result.rows[0].org_id;
      
      // Allow cross-org access only for super admins
      if (resourceOrgId !== req.orgId && !req.tenantContext?.canAccessAllOrgs) {
        return res.status(403).json({ 
          error: `Access denied to ${resourceType} from different organization`,
          code: 'CROSS_TENANT_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('Resource ownership validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Utility to sanitize data for multi-tenant queries
export class TenantQueryBuilder {
  private orgId: number;
  
  constructor(orgId: number) {
    this.orgId = orgId;
  }
  
  // Add org filter to WHERE clause
  addOrgFilter(query: string, alias: string = ''): string {
    const table = alias || 't';
    const orgFilter = `${table}.org_id = ${this.orgId}`;
    
    if (query.toLowerCase().includes('where')) {
      return query.replace(/where/i, `WHERE ${orgFilter} AND`);
    } else {
      return `${query} WHERE ${orgFilter}`;
    }
  }
  
  // Ensure INSERT statements include org_id
  addOrgToInsert(insertData: Record<string, any>): Record<string, any> {
    return {
      ...insertData,
      org_id: this.orgId
    };
  }
  
  // Validate that user can access the specified org data
  validateOrgAccess(dataOrgId: number, allowCrossOrg: boolean = false): boolean {
    return dataOrgId === this.orgId || allowCrossOrg;
  }
}

// Log security events
export async function logSecurityEvent(
  userId: number,
  orgId: number,
  eventType: string,
  details: Record<string, any>
) {
  try {
    await pool.query(`
      INSERT INTO security_audit_log (user_id, org_id, event_type, details, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [userId, orgId, eventType, JSON.stringify(details)]);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Create security audit log table
export async function initializeSecurityAuditLog() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        org_id INTEGER NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_security_audit_user_org 
      ON security_audit_log(user_id, org_id);
      
      CREATE INDEX IF NOT EXISTS idx_security_audit_created_at 
      ON security_audit_log(created_at);
    `);
  } catch (error) {
    console.error('Failed to initialize security audit log:', error);
  }
}