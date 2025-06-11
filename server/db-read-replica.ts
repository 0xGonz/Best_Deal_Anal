/**
 * Database read replica configuration for read-heavy workload optimization
 * 
 * This module simulates a read-replica pattern where read operations are distributed
 * between the primary database and replicas, while write operations always go to the primary.
 * 
 * In a production environment, this would connect to actual read replicas; in our
 * current setup it simulates the pattern for future extensibility.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '@shared/schema';
import ws from 'ws';
import { LoggingService } from './services/LoggingService';

// Configure neon to use websockets
neonConfig.webSocketConstructor = ws;

// Environment variables
const databaseUrl = process.env.DATABASE_URL;
const readReplicaUrl = process.env.READ_REPLICA_URL || databaseUrl;
const enableReadReplica = process.env.ENABLE_READ_REPLICA === 'true';
const readReplicaCount = parseInt(process.env.READ_REPLICA_COUNT || '1', 10);
const roundRobinEnabled = process.env.ROUND_ROBIN_READS === 'true';

// Get logger instance
const logger = LoggingService.getInstance();

// Class to manage database connections
export class DatabaseManager {
  private static instance: DatabaseManager;
  private primaryPool: Pool;
  private replicaPools: Pool[] = [];
  private lastUsedReplica = 0;

  constructor() {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must be provided');
    }

    // Create primary connection pool
    this.primaryPool = new Pool({ 
      connectionString: databaseUrl,
      max: 10 // Maximum number of clients in the pool
    });

    // Initialize read replica pools if enabled
    if (enableReadReplica) {
      if (readReplicaUrl === databaseUrl) {
        logger.warn('READ_REPLICA_URL is the same as DATABASE_URL - this simulates read replicas but does not provide true read scaling');
      }

      // Create replica pools (in production, these would be actual replicas)
      for (let i = 0; i < readReplicaCount; i++) {
        this.replicaPools.push(new Pool({
          connectionString: readReplicaUrl,
          max: 20 // Higher connection limit for read replicas
        }));
        logger.info(`Initialized read replica pool #${i + 1}`);
      }
    } else {
      logger.info('Read replicas are disabled, all operations will use the primary database');
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get the primary database connection pool
   */
  public getPrimaryPool(): Pool {
    return this.primaryPool;
  }

  /**
   * Get a database pool for read operations
   * This implements a simple round-robin selection among available replicas
   */
  public getReadPool(): Pool {
    // If replicas are not enabled or no replica pools exist, return primary
    if (!enableReadReplica || this.replicaPools.length === 0) {
      return this.primaryPool;
    }

    // If round-robin is disabled, always use the first replica
    if (!roundRobinEnabled) {
      return this.replicaPools[0];
    }

    // Select a replica using round-robin
    const poolIndex = this.lastUsedReplica;
    this.lastUsedReplica = (this.lastUsedReplica + 1) % this.replicaPools.length;
    return this.replicaPools[poolIndex];
  }

  /**
   * Get drizzle instance for write operations (always uses primary)
   */
  public getPrimaryDB() {
    return drizzle(this.primaryPool, { schema });
  }

  /**
   * Get drizzle instance for read operations (may use replicas)
   */
  public getReadDB() {
    return drizzle(this.getReadPool(), { schema });
  }

  /**
   * Close all database connections
   */
  public async closeAll(): Promise<void> {
    await this.primaryPool.end();
    
    for (const pool of this.replicaPools) {
      await pool.end();
    }
  }
}

// Create and export the database manager instance
const dbManager = DatabaseManager.getInstance();

// Export database connections
export const primaryDB = dbManager.getPrimaryDB();
export const readDB = dbManager.getReadDB();
export const pool = dbManager.getPrimaryPool();

// For compatibility with existing code
export const db = primaryDB;