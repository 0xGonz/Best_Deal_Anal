import { pool } from '../db';
import type { User } from '../../shared/schema';

export interface AuditLogEntry {
  id?: number;
  entityType: string;
  entityId: number;
  action: string;
  userId: number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

export class AuditService {
  /**
   * Custom JSON replacer to handle date objects properly
   */
  private static dateReplacer(key: string, value: any): any {
    // Handle null or undefined values
    if (value === null || value === undefined) {
      return value;
    }
    
    // Handle actual Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Handle date strings that are already in ISO format
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return value;
    }
    
    // Handle PostgreSQL timestamp objects
    if (value && typeof value === 'object' && typeof value.toISOString === 'function') {
      try {
        return value.toISOString();
      } catch (error) {
        console.warn('Failed to convert object to ISO string:', value, error);
        return String(value);
      }
    }
    
    // Return primitive values as-is
    return value;
  }

  /**
   * Log an audit entry for tracking data changes
   */
  static async logAction(entry: AuditLogEntry): Promise<void> {
    try {
      const client = await pool.connect();
      
      await client.query(`
        INSERT INTO audit_logs (
          entity_type, 
          entity_id, 
          action, 
          user_id, 
          old_values, 
          new_values, 
          metadata, 
          ip_address, 
          user_agent, 
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.userId,
        entry.oldValues ? JSON.stringify(entry.oldValues, AuditService.dateReplacer) : null,
        entry.newValues ? JSON.stringify(entry.newValues, AuditService.dateReplacer) : null,
        entry.metadata ? JSON.stringify(entry.metadata, AuditService.dateReplacer) : null,
        entry.ipAddress,
        entry.userAgent
      ]);
      
      client.release();
      console.log(`Audit logged: ${entry.action} on ${entry.entityType} ${entry.entityId} by user ${entry.userId}`);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Log allocation creation with validation details
   */
  static async logAllocationCreation(
    allocationId: number, 
    allocationData: any, 
    userId: number, 
    request: any
  ): Promise<void> {
    await this.logAction({
      entityType: 'fund_allocation',
      entityId: allocationId,
      action: 'CREATE',
      userId,
      newValues: {
        fundId: allocationData.fundId,
        dealId: allocationData.dealId,
        amount: allocationData.amount,
        amountType: allocationData.amountType,
        securityType: allocationData.securityType,
        status: allocationData.status
      },
      metadata: {
        capitalCallSchedule: allocationData.capitalCallSchedule || request.body.capitalCallSchedule,
        callCount: request.body.callCount,
        callPercentage: request.body.callPercentage,
        callAmountType: request.body.callAmountType,
        callDollarAmount: request.body.callDollarAmount,
        source: 'allocation_form'
      },
      ipAddress: request.ip || request.connection?.remoteAddress,
      userAgent: request.get('User-Agent')
    });
  }

  /**
   * Log allocation modifications
   */
  static async logAllocationUpdate(
    allocationId: number,
    oldValues: any,
    newValues: any,
    userId: number,
    request: any
  ): Promise<void> {
    await this.logAction({
      entityType: 'fund_allocation',
      entityId: allocationId,
      action: 'UPDATE',
      userId,
      oldValues,
      newValues,
      metadata: {
        source: 'allocation_update'
      },
      ipAddress: request.ip || request.connection?.remoteAddress,
      userAgent: request.get('User-Agent')
    });
  }

  /**
   * Log capital call creation
   */
  static async logCapitalCallCreation(
    capitalCallId: number,
    capitalCallData: any,
    allocationId: number,
    userId: number,
    request?: any
  ): Promise<void> {
    await this.logAction({
      entityType: 'capital_call',
      entityId: capitalCallId,
      action: 'CREATE',
      userId,
      newValues: {
        allocationId,
        callAmount: capitalCallData.callAmount,
        amountType: capitalCallData.amountType,
        callDate: capitalCallData.callDate,
        dueDate: capitalCallData.dueDate,
        status: capitalCallData.status
      },
      metadata: {
        source: 'capital_call_service',
        allocationId
      },
      ipAddress: request?.ip || request?.connection?.remoteAddress,
      userAgent: request?.get('User-Agent')
    });
  }

  /**
   * Get audit trail for an entity
   */
  static async getAuditTrail(entityType: string, entityId: number): Promise<AuditLogEntry[]> {
    try {
      const client = await pool.connect();
      
      const result = await client.query(`
        SELECT 
          al.*,
          u.full_name as user_name,
          u.username
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.entity_type = $1 AND al.entity_id = $2
        ORDER BY al.created_at DESC
      `, [entityType, entityId]);
      
      client.release();
      return result.rows;
    } catch (error) {
      console.error('Failed to get audit trail:', error);
      return [];
    }
  }
}