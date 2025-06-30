import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import { AUTH_ERRORS } from '../constants/auth-constants';

/**
 * Permission types that can be checked
 */
export type Permission = 'create' | 'view' | 'edit' | 'delete';

/**
 * Resource types in the application
 */
export type ResourceType = 'deal' | 'fund' | 'user' | 'document' | 'allocation' | 'capital-call' | 'closingEvent';

/**
 * Role hierarchy for permission checks
 * Ordered from highest to lowest privileges
 */
const roleHierarchy = ['admin', 'partner', 'analyst', 'observer', 'intern'];

/**
 * Get the numeric level of a role for comparison
 * Higher number = higher privileges
 */
function getRoleLevel(role: string): number {
  const index = roleHierarchy.indexOf(role);
  return index === -1 ? -1 : roleHierarchy.length - index - 1;
}

/**
 * Check if a user has a specific permission for a resource type
 */
export function hasPermission(user: any, permission: Permission, resourceType: ResourceType): boolean {
  if (!user) return false;
  
  const { role } = user;
  
  // Admin has all permissions
  if (role === 'admin') return true;
  
  // Partner has all permissions except user management delete
  if (role === 'partner') {
    if (resourceType === 'user' && permission === 'delete') return false;
    return true;
  }
  
  // Analyst can create, view, edit most resources but cannot delete
  if (role === 'analyst') {
    if (permission === 'delete') return false;
    return true;
  }
  
  // Observer can only view
  if (role === 'observer') {
    return permission === 'view';
  }
  
  // Intern can view everything and only create/edit deals
  if (role === 'intern') {
    if (permission === 'view') return true;
    if ((permission === 'create' || permission === 'edit') && resourceType === 'deal') return true;
    return false;
  }
  
  return false;
}

/**
 * Middleware to check if a user has permission to perform an action on a resource
 */
export function requirePermission(permission: Permission, resourceType: ResourceType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return next(new AppError(AUTH_ERRORS.AUTH_REQUIRED, 401));
    }
    
    if (!hasPermission(user, permission, resourceType)) {
      return next(new AppError(AUTH_ERRORS.PERMISSION_DENIED, 403));
    }
    
    next();
  };
}
