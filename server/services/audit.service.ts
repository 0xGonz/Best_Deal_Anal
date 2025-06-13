/**
 * Enterprise Audit Service
 * 
 * Comprehensive audit logging for investment workflows with
 * structured event tracking, compliance reporting, and security monitoring.
 */

import { StorageFactory } from '../storage-factory.js';
import { LoggingService } from './LoggingService.js';

export interface AuditEvent {
  eventType: string;
  userId: number;
  entityType: string;
  entityId: number;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface WorkflowAuditContext {
  dealId?: number;
  fundId?: number;
  allocationId?: number;
  userId: number;
  metadata?: Record<string, any>;
}

export class AuditService {
  private storage = StorageFactory.getStorage();
  private logger = LoggingService.getInstance();

  async logWorkflowEvent(
    eventType: string,
    context: WorkflowAuditContext,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        eventType,
        userId: context.userId,
        entityType: this.determineEntityType(context),
        entityId: this.determineEntityId(context),
        action: eventType,
        details: {
          ...details,
          context,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date()
      };

      // Log to structured audit table
      await this.createAuditRecord(auditEvent);

      // Log to application logs for immediate monitoring
      this.logger.info(`Audit Event: ${eventType}`, {
        userId: context.userId,
        entityType: auditEvent.entityType,
        entityId: auditEvent.entityId,
        details: details
      });

    } catch (error) {
      this.logger.error('Failed to log audit event', { error, eventType, context });
    }
  }

  async logSecurityEvent(
    eventType: string,
    userId: number,
    details: Record<string, any>
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      eventType: `security_${eventType}`,
      userId,
      entityType: 'user',
      entityId: userId,
      action: eventType,
      details: {
        ...details,
        securityLevel: 'high',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };

    await this.createAuditRecord(auditEvent);
    this.logger.warn(`Security Event: ${eventType}`, { userId, details });
  }

  async logDataChange(
    entityType: string,
    entityId: number,
    changes: Record<string, any>,
    userId: number
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      eventType: 'data_change',
      userId,
      entityType,
      entityId,
      action: 'update',
      details: {
        changes,
        changeCount: Object.keys(changes).length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };

    await this.createAuditRecord(auditEvent);
  }

  async getAuditTrail(
    entityType: string,
    entityId: number,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    // Implementation would fetch from audit table
    // For now, return empty array
    return [];
  }

  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    userActivity: Record<string, number>;
    securityEvents: number;
  }> {
    // Implementation would generate compliance report
    return {
      totalEvents: 0,
      eventsByType: {},
      userActivity: {},
      securityEvents: 0
    };
  }

  private determineEntityType(context: WorkflowAuditContext): string {
    if (context.allocationId) return 'allocation';
    if (context.dealId) return 'deal';
    if (context.fundId) return 'fund';
    return 'system';
  }

  private determineEntityId(context: WorkflowAuditContext): number {
    return context.allocationId || context.dealId || context.fundId || 0;
  }

  private async createAuditRecord(event: AuditEvent): Promise<void> {
    // Implementation would create audit record in database
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('AUDIT:', JSON.stringify(event, null, 2));
    }
  }
}