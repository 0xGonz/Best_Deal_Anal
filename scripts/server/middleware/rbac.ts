/**
 * Role-Based Access Control (RBAC) Middleware
 */

import { Request, Response, NextFunction } from 'express';

export enum UserRole {
  ADMIN = 'admin',
  FUND_MANAGER = 'fund_manager',
  ANALYST = 'analyst',
  VIEWER = 'viewer'
}

export enum Permission {
  CREATE_DEAL = 'create_deal',
  EDIT_DEAL = 'edit_deal',
  DELETE_DEAL = 'delete_deal',
  VIEW_DEAL = 'view_deal',
  CREATE_FUND = 'create_fund',
  EDIT_FUND = 'edit_fund',
  DELETE_FUND = 'delete_fund',
  VIEW_FUND = 'view_fund',
  UPLOAD_DOCUMENT = 'upload_document',
  EDIT_DOCUMENT = 'edit_document',
  DELETE_DOCUMENT = 'delete_document',
  VIEW_DOCUMENT = 'view_document'
}

// Role-permission mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.FUND_MANAGER]: [
    Permission.CREATE_DEAL, Permission.EDIT_DEAL, Permission.VIEW_DEAL,
    Permission.CREATE_FUND, Permission.EDIT_FUND, Permission.VIEW_FUND,
    Permission.UPLOAD_DOCUMENT, Permission.EDIT_DOCUMENT, Permission.VIEW_DOCUMENT
  ],
  [UserRole.ANALYST]: [
    Permission.VIEW_DEAL, Permission.EDIT_DEAL,
    Permission.VIEW_FUND,
    Permission.UPLOAD_DOCUMENT, Permission.VIEW_DOCUMENT
  ],
  [UserRole.VIEWER]: [
    Permission.VIEW_DEAL, Permission.VIEW_FUND, Permission.VIEW_DOCUMENT
  ]
};

export class RBACService {
  hasPermission(userRole: UserRole, permission: Permission): boolean {
    const permissions = rolePermissions[userRole];
    return permissions.includes(permission);
  }
}

// Middleware factory for permission checking
export const requirePermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // For now, assume user role is in session
    const userRole = req.session.role as UserRole;
    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    const rbac = new RBACService();
    if (!rbac.hasPermission(userRole, permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userRole: userRole
      });
    }

    next();
  };
};

export default {
  RBACService,
  requirePermission,
  UserRole,
  Permission
};