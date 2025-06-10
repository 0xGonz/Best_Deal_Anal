/**
 * Standardized API response types for type safety across the application
 */

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  status: 'success' | 'error';
  timestamp: string;
}

export interface ApiError {
  status: number;
  message: string;
  code: string;
  context?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  storage: 'database' | 'memory' | 'hybrid' | 'pg' | 'unknown';
  databaseConnected: boolean;
  environment: string;
  metrics?: {
    uptime: number;
    requests: number;
    errors: number;
    errorRate: number;
  };
}

export interface AuthResponse {
  user: {
    id: number;
    username: string;
    fullName?: string;
    role: string;
  } | null;
  authenticated: boolean;
}