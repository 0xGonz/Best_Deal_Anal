import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Add WebSocket support for Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set. Database is required for this application.');
}

// Create direct pool/db exports, not nullable anymore
console.log('Initializing database connection...');

// Configure the pool with optimized settings for document access
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Increased for better performance
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 10000, // 10 second connection timeout
  allowExitOnIdle: false,
  ssl: { rejectUnauthorized: false }
});

// Set up event handlers for the pool
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  // Don't crash, just log the error
});

pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error:', err);
  });
});

// Test the connection by running a simple query
pool.query('SELECT 1 AS test')
  .then(() => {
    console.log('Database connection verified successfully');
  })
  .catch(err => {
    console.error('Database connection test failed:', err);
    console.error('Continuing with memory storage');
    
    // Attempt to reconnect after a delay
    setTimeout(() => {
      console.log('Attempting to reconnect to database...');
      pool.query('SELECT 1 AS test')
        .then(() => {
          console.log('Database reconnection successful');
        })
        .catch(reconnectErr => {
          console.error('Database reconnection failed:', reconnectErr);
        });
    }, 5000); // Try again after 5 seconds
  });

// Create a simple health check that doesn't interfere with the main pool
const checkPoolHealth = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
  } catch (err) {
    console.error('Database health check failed:', err);
    // Log error but don't attempt to recreate pools
  }
};

// Run health check every 10 minutes (reduced frequency)
setInterval(checkPoolHealth, 10 * 60 * 1000);

export { pool };
export const db = drizzle(pool, { schema });
console.log('Database connection initialized successfully');
