/**
 * Secure query utilities to prevent SQL injection
 */

import { sql } from 'drizzle-orm';

export class SecureQueryBuilder {
  /**
   * Safely build dynamic WHERE clauses
   */
  static buildWhereClause(conditions: Record<string, any>) {
    const clauses = Object.entries(conditions)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([column, value]) => sql`${sql.identifier(column)} = ${value}`);
    
    return clauses.length > 0 ? sql.join(clauses, sql` AND `) : undefined;
  }

  /**
   * Secure string concatenation for SQL
   */
  static concat(...values: any[]) {
    return sql`CONCAT(${sql.join(values, sql`, `)})`;
  }

  /**
   * Secure JSON object builder
   */
  static jsonObject(obj: Record<string, any>) {
    const pairs = Object.entries(obj).map(([key, value]) => 
      sql`${key}, ${value}`
    );
    return sql`json_build_object(${sql.join(pairs, sql`, `)})`;
  }

  /**
   * Secure date range filter
   */
  static dateRange(column: any, startDate?: Date, endDate?: Date) {
    const conditions = [];
    if (startDate) conditions.push(sql`${column} >= ${startDate}`);
    if (endDate) conditions.push(sql`${column} <= ${endDate}`);
    return conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;
  }
}