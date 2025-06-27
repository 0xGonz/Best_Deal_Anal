/**
 * Centralized error handling service for modular and reliable error management
 * This service provides consistent error handling across the application
 */

import { ApplicationError, ValidationError, DatabaseError, NotFoundError } from './type-definitions';

export class ErrorHandlerService {
  /**
   * Handle and format errors for API responses
   */
  static handleError(error: unknown): {
    status: number;
    message: string;
    code: string;
    context?: Record<string, any>;
  } {
    console.error('Error occurred:', error);

    if (error instanceof ApplicationError) {
      return {
        status: error.statusCode,
        message: error.message,
        code: error.code,
        context: error.context
      };
    }

    if (error instanceof Error) {
      // Handle known error types
      if (error.message.includes('Connection terminated')) {
        return {
          status: 503,
          message: 'Database connection timeout. Please try again.',
          code: 'DATABASE_TIMEOUT'
        };
      }

      if (error.message.includes('duplicate key')) {
        return {
          status: 409,
          message: 'Resource already exists',
          code: 'DUPLICATE_RESOURCE'
        };
      }

      if (error.message.includes('not found')) {
        return {
          status: 404,
          message: 'Resource not found',
          code: 'NOT_FOUND'
        };
      }

      // Generic error handling
      return {
        status: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }

    // Unknown error type
    return {
      status: 500,
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Validate request data and throw ValidationError if invalid
   */
  static validateRequest(data: any, rules: Record<string, (value: any) => boolean | string>): void {
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      const result = rule(value);
      
      if (typeof result === 'string') {
        throw new ValidationError(result, field, { value });
      } else if (!result) {
        throw new ValidationError(`Invalid value for ${field}`, field, { value });
      }
    }
  }

  /**
   * Safely execute database operations with error handling
   */
  static async safeDbOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Connection terminated')) {
        throw new DatabaseError(`Database timeout during ${operationName}`, { operationName });
      }
      throw new DatabaseError(`Failed to execute ${operationName}: ${error instanceof Error ? error.message : 'Unknown error'}`, { operationName });
    }
  }

  /**
   * Create standardized API response
   */
  static createResponse<T>(data: T, message?: string) {
    return {
      success: true,
      data,
      message,
      timestamp: new Date()
    };
  }

  /**
   * Create standardized error response
   */
  static createErrorResponse(error: unknown) {
    const errorInfo = this.handleError(error);
    return {
      success: false,
      error: {
        message: errorInfo.message,
        code: errorInfo.code,
        context: errorInfo.context
      },
      timestamp: new Date()
    };
  }
}

// Common validation rules
export const ValidationRules = {
  required: (value: any) => value !== null && value !== undefined && value !== '',
  
  isNumber: (value: any) => !isNaN(Number(value)) && Number(value) >= 0,
  
  isPositiveNumber: (value: any) => !isNaN(Number(value)) && Number(value) > 0,
  
  isString: (value: any) => typeof value === 'string' && value.length > 0,
  
  isEmail: (value: any) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  
  isDate: (value: any) => value instanceof Date || !isNaN(Date.parse(value)),
  
  maxLength: (max: number) => (value: any) => 
    typeof value === 'string' && value.length <= max,
  
  minLength: (min: number) => (value: any) => 
    typeof value === 'string' && value.length >= min,
  
  isOneOf: (options: any[]) => (value: any) => options.includes(value),
  
  isAmountType: (value: any) => ['dollar', 'percentage'].includes(value),
  
  isCallStatus: (value: any) => 
    ['scheduled', 'called', 'partial', 'paid', 'defaulted', 'overdue', 'partially_paid'].includes(value)
};