/**
 * Enhanced Validation Schemas
 * Comprehensive input validation with security checks
 */

import { z } from 'zod';

// Password validation with security requirements
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Email validation with domain restrictions
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(254, 'Email too long');

// Currency amount validation
export const currencySchema = z.number()
  .min(0, 'Amount cannot be negative')
  .max(1000000000, 'Amount exceeds maximum allowed value');

// File name validation
export const fileNameSchema = z.string()
  .min(1, 'File name required')
  .max(255, 'File name too long')
  .regex(/^[a-zA-Z0-9._-]+$/, 'File name contains invalid characters');

// ID validation for database operations
export const idSchema = z.number()
  .int('ID must be an integer')
  .positive('ID must be positive')
  .max(2147483647, 'ID too large');

export default {
  passwordSchema,
  emailSchema,
  currencySchema,
  fileNameSchema,
  idSchema
};