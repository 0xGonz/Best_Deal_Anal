
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
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

export function createPaginationOptions(query: any): PaginationOptions {
  const page = Math.max(1, parseInt(query.page || '1'));
  const limit = Math.min(100, Math.max(10, parseInt(query.limit || '20')));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}