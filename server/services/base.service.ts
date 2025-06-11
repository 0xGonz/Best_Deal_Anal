import { sql } from 'drizzle-orm';

/**
 * Base service class with shared functionality for all services
 */
export class BaseService {
  /**
   * SQL builder for use in Drizzle queries
   */
  protected sql = sql;
}