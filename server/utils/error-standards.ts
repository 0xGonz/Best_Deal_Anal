
export interface StandardError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export class ErrorResponseBuilder {
  static build(error: any): StandardError {
    return {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.details,
      timestamp: new Date().toISOString()
    };
  }

  static validation(message: string, details?: any): StandardError {
    return {
      code: 'VALIDATION_ERROR',
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }

  static notFound(resource: string): StandardError {
    return {
      code: 'NOT_FOUND',
      message: `${resource} not found`,
      timestamp: new Date().toISOString()
    };
  }
}