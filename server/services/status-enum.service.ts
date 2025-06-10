/**
 * Centralized status enum service for consistent status management
 */

import { ALLOCATION_STATUS, CAPITAL_CALL_STATUS, DEAL_STAGES } from '@shared/constants';

export class StatusEnumService {
  /**
   * Validate allocation status
   */
  static isValidAllocationStatus(status: string): boolean {
    return Object.values(ALLOCATION_STATUS).includes(status as any);
  }

  /**
   * Get default allocation status
   */
  static getDefaultAllocationStatus(): string {
    return ALLOCATION_STATUS.COMMITTED;
  }

  /**
   * Calculate allocation status based on amounts
   */
  static calculateAllocationStatus(amount: number, paidAmount: number): string {
    if (paidAmount <= 0) return ALLOCATION_STATUS.COMMITTED;
    if (paidAmount >= amount) return ALLOCATION_STATUS.FUNDED;
    return ALLOCATION_STATUS.PARTIALLY_PAID;
  }

  /**
   * Validate capital call status
   */
  static isValidCapitalCallStatus(status: string): boolean {
    return Object.values(CAPITAL_CALL_STATUS).includes(status as any);
  }

  /**
   * Get default capital call status
   */
  static getDefaultCapitalCallStatus(): string {
    return CAPITAL_CALL_STATUS.SCHEDULED;
  }

  /**
   * Validate deal stage
   */
  static isValidDealStage(stage: string): boolean {
    return Object.values(DEAL_STAGES).includes(stage as any);
  }

  /**
   * Get default deal stage
   */
  static getDefaultDealStage(): string {
    return DEAL_STAGES.INITIAL_REVIEW;
  }

  /**
   * Get all valid allocation statuses
   */
  static getAllAllocationStatuses(): string[] {
    return Object.values(ALLOCATION_STATUS);
  }

  /**
   * Get all valid capital call statuses
   */
  static getAllCapitalCallStatuses(): string[] {
    return Object.values(CAPITAL_CALL_STATUS);
  }

  /**
   * Get all valid deal stages
   */
  static getAllDealStages(): string[] {
    return Object.values(DEAL_STAGES);
  }
}