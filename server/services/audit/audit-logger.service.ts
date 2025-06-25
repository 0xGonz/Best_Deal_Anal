/**
 * Audit Logger Service
 * Comprehensive audit trail for all financial operations
 */

import { db } from '../../db';
import { auditLogs } from '@shared/schema';
import type { InsertAuditLog } from '@shared/schema';

export interface AuditOperation {
  id: string;
  type: string;
  userId: number;
  startTime: Date;
  context: Record<string, any>;
}

export class AuditLogger {
  private activeOperations = new Map<string, AuditOperation>();

  /**
   * Start audited operation
   */
  async startOperation(
    operationType: string,
    userId: number,
    context: Record<string, any> = {}
  ): Promise<string> {
    const operationId = this.generateOperationId();
    
    const operation: AuditOperation = {
      id: operationId,
      type: operationType,
      userId,
      startTime: new Date(),
      context
    };

    this.activeOperations.set(operationId, operation);

    // Log operation start
    await this.logEvent({
      entityType: 'operation',
      entityId: 0,
      action: 'START',
      userId,
      newValues: JSON.stringify({
        operationId,
        operationType,
        context
      }),
      metadata: JSON.stringify({
        timestamp: operation.startTime.toISOString(),
        phase: 'start'
      })
    });

    return operationId;
  }

  /**
   * Log successful operation completion
   */
  async logSuccess(
    operationId: string,
    message: string,
    additionalData: Record<string, any> = {}
  ): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      console.warn(`Audit operation ${operationId} not found`);
      return;
    }

    const duration = Date.now() - operation.startTime.getTime();

    await this.logEvent({
      entityType: 'operation',
      entityId: 0,
      action: 'SUCCESS',
      userId: operation.userId,
      newValues: JSON.stringify({
        operationId,
        message,
        ...additionalData
      }),
      metadata: JSON.stringify({
        operationType: operation.type,
        duration,
        timestamp: new Date().toISOString(),
        phase: 'success'
      })
    });

    this.activeOperations.delete(operationId);
  }

  /**
   * Log operation error
   */
  async logError(
    operationId: string,
    errorMessage: string,
    errorDetails?: any
  ): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      // Still log the error even if operation not found
      await this.logEvent({
        entityType: 'operation',
        entityId: 0,
        action: 'ERROR',
        userId: 0,
        newValues: JSON.stringify({
          operationId,
          errorMessage,
          errorDetails: this.sanitizeError(errorDetails)
        }),
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          phase: 'error',
          orphaned: true
        })
      });
      return;
    }

    const duration = Date.now() - operation.startTime.getTime();

    await this.logEvent({
      entityType: 'operation',
      entityId: 0,
      action: 'ERROR',
      userId: operation.userId,
      newValues: JSON.stringify({
        operationId,
        errorMessage,
        errorDetails: this.sanitizeError(errorDetails)
      }),
      metadata: JSON.stringify({
        operationType: operation.type,
        duration,
        timestamp: new Date().toISOString(),
        phase: 'error'
      })
    });

    this.activeOperations.delete(operationId);
  }

  /**
   * Log entity changes
   */
  async logEntityChange(
    entityType: string,
    entityId: number,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    userId: number,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      entityType,
      entityId,
      action,
      userId,
      oldValues: oldValues ? JSON.stringify(oldValues) : undefined,
      newValues: newValues ? JSON.stringify(newValues) : undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    });
  }

  /**
   * Log financial transaction
   */
  async logFinancialTransaction(
    transactionType: string,
    entityId: number,
    userId: number,
    amount: number,
    currency: string = 'USD',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      entityType: 'financial_transaction',
      entityId,
      action: transactionType.toUpperCase(),
      userId,
      newValues: JSON.stringify({
        amount,
        currency,
        transactionType
      }),
      metadata: JSON.stringify({
        ...metadata,
        timestamp: new Date().toISOString(),
        auditLevel: 'financial'
      })
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    eventType: string,
    userId: number,
    description: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      entityType: 'security_event',
      entityId: userId,
      action: eventType.toUpperCase(),
      userId,
      newValues: JSON.stringify({
        description,
        severity
      }),
      metadata: JSON.stringify({
        ...metadata,
        timestamp: new Date().toISOString(),
        auditLevel: 'security'
      })
    });
  }

  /**
   * Get audit trail for entity
   */
  async getAuditTrail(
    entityType: string,
    entityId: number,
    limit: number = 100
  ): Promise<any[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(
        db.and(
          db.eq(auditLogs.entityType, entityType),
          db.eq(auditLogs.entityId, entityId)
        )
      )
      .orderBy(db.desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Get operations by user
   */
  async getUserOperations(
    userId: number,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<any[]> {
    let query = db
      .select()
      .from(auditLogs)
      .where(db.eq(auditLogs.userId, userId));

    if (startDate) {
      query = query.where(db.gte(auditLogs.createdAt, startDate));
    }

    if (endDate) {
      query = query.where(db.lte(auditLogs.createdAt, endDate));
    }

    return await query
      .orderBy(db.desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Get financial audit summary
   */
  async getFinancialAuditSummary(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTransactions: number;
    totalAmount: number;
    transactionsByType: Record<string, number>;
    userActivity: Record<string, number>;
  }> {
    const financialLogs = await db
      .select()
      .from(auditLogs)
      .where(
        db.and(
          db.eq(auditLogs.entityType, 'financial_transaction'),
          db.gte(auditLogs.createdAt, startDate),
          db.lte(auditLogs.createdAt, endDate)
        )
      );

    const summary = {
      totalTransactions: financialLogs.length,
      totalAmount: 0,
      transactionsByType: {} as Record<string, number>,
      userActivity: {} as Record<string, number>
    };

    for (const log of financialLogs) {
      // Parse transaction data
      try {
        const data = JSON.parse(log.newValues || '{}');
        if (data.amount) {
          summary.totalAmount += data.amount;
        }

        // Count by type
        if (data.transactionType) {
          summary.transactionsByType[data.transactionType] = 
            (summary.transactionsByType[data.transactionType] || 0) + 1;
        }

        // Count by user
        const userId = log.userId.toString();
        summary.userActivity[userId] = (summary.userActivity[userId] || 0) + 1;
      } catch (error) {
        console.warn('Failed to parse audit log data:', error);
      }
    }

    return summary;
  }

  /**
   * Private helper methods
   */
  private async logEvent(event: InsertAuditLog): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        ...event,
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null
      });
    } catch (error) {
      // Never let audit logging break the main operation
      console.error('Audit logging failed:', error);
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5) // Limit stack trace
      };
    }

    if (typeof error === 'object' && error !== null) {
      // Remove sensitive data
      const sanitized = { ...error };
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.secret;
      delete sanitized.key;
      return sanitized;
    }

    return error;
  }

  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db
      .delete(auditLogs)
      .where(db.lt(auditLogs.createdAt, cutoffDate));

    return result.rowCount || 0;
  }

  /**
   * Get active operations (for monitoring)
   */
  getActiveOperations(): AuditOperation[] {
    return Array.from(this.activeOperations.values());
  }
}

export const auditLogger = new AuditLogger();