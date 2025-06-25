/**
 * Database Transaction Service
 * Provides atomic transaction management with proper error handling
 */

import { db } from '../../db';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';

export type Transaction = PgTransaction<NodePgQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;

export interface TransactionOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export class DatabaseTransaction {
  private readonly defaultOptions: Required<TransactionOptions> = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000
  };

  /**
   * Execute operation in atomic transaction with retry logic
   */
  async execute<T>(
    operation: (tx: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        return await this.executeWithTimeout(operation, opts.timeout);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry certain types of errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        // Don't retry on final attempt
        if (attempt === opts.maxRetries) {
          break;
        }

        // Wait before retry
        await this.delay(opts.retryDelay * attempt);
        console.warn(`Transaction attempt ${attempt} failed, retrying...`, error);
      }
    }

    throw new Error(`Transaction failed after ${opts.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async executeBatch<T>(
    operations: Array<(tx: Transaction) => Promise<T>>,
    options?: TransactionOptions
  ): Promise<T[]> {
    return this.execute(async (tx) => {
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation(tx);
        results.push(result);
      }
      return results;
    }, options);
  }

  /**
   * Execute operation with conditional rollback
   */
  async executeWithValidation<T>(
    operation: (tx: Transaction) => Promise<T>,
    validator: (result: T) => boolean | Promise<boolean>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.execute(async (tx) => {
      const result = await operation(tx);
      const isValid = await validator(result);
      
      if (!isValid) {
        throw new Error('Transaction validation failed - rolling back');
      }
      
      return result;
    }, options);
  }

  /**
   * Execute read-only transaction (for consistency)
   */
  async executeReadOnly<T>(
    operation: (tx: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.execute(async (tx) => {
      // Set transaction to read-only
      await tx.execute('SET TRANSACTION READ ONLY');
      return operation(tx);
    }, options);
  }

  /**
   * Private helper methods
   */
  private async executeWithTimeout<T>(
    operation: (tx: Transaction) => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Transaction timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      db.transaction(operation)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private shouldNotRetry(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    
    // Don't retry validation errors
    if (message.includes('validation') || message.includes('constraint')) {
      return true;
    }

    // Don't retry unique violations
    if (message.includes('unique') || message.includes('duplicate')) {
      return true;
    }

    // Don't retry foreign key violations
    if (message.includes('foreign key') || message.includes('reference')) {
      return true;
    }

    // Don't retry syntax errors
    if (message.includes('syntax')) {
      return true;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Transaction utilities
   */
  
  /**
   * Execute operation with savepoint (nested transaction simulation)
   */
  async executeWithSavepoint<T>(
    operation: (tx: Transaction) => Promise<T>,
    savepointName: string = 'sp1'
  ): Promise<T> {
    return this.execute(async (tx) => {
      // Create savepoint
      await tx.execute(`SAVEPOINT ${savepointName}`);
      
      try {
        const result = await operation(tx);
        // Release savepoint on success
        await tx.execute(`RELEASE SAVEPOINT ${savepointName}`);
        return result;
      } catch (error) {
        // Rollback to savepoint on error
        await tx.execute(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        throw error;
      }
    });
  }

  /**
   * Execute operations in parallel within a transaction
   */
  async executeParallel<T>(
    operations: Array<(tx: Transaction) => Promise<T>>,
    options?: TransactionOptions
  ): Promise<T[]> {
    return this.execute(async (tx) => {
      // Execute all operations in parallel
      return Promise.all(operations.map(op => op(tx)));
    }, options);
  }

  /**
   * Execute operation with custom isolation level
   */
  async executeWithIsolation<T>(
    operation: (tx: Transaction) => Promise<T>,
    isolationLevel: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE',
    options?: TransactionOptions
  ): Promise<T> {
    return this.execute(async (tx) => {
      await tx.execute(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      return operation(tx);
    }, options);
  }

  /**
   * Execute with advisory lock
   */
  async executeWithLock<T>(
    operation: (tx: Transaction) => Promise<T>,
    lockKey: number,
    options?: TransactionOptions
  ): Promise<T> {
    return this.execute(async (tx) => {
      // Acquire advisory lock
      await tx.execute(`SELECT pg_advisory_lock(${lockKey})`);
      
      try {
        const result = await operation(tx);
        return result;
      } finally {
        // Always release the lock
        await tx.execute(`SELECT pg_advisory_unlock(${lockKey})`);
      }
    }, options);
  }
}

export const databaseTransaction = new DatabaseTransaction();