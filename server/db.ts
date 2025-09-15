import { Pool, neonConfig, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Database connection state tracking
let connectionAttempts = 0;

// Improved pool configuration for better stability
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Smaller pool to prevent overwhelming Neon
  maxUses: 1000, // Cycle connections more frequently
  connectionTimeoutMillis: 15000, // Faster failure detection
  idleTimeoutMillis: 120000, // Prevent stale connections
  allowExitOnIdle: false,
  statement_timeout: 60000, // 60 second query timeout
  query_timeout: 60000,
  application_name: 'dashboard-app',
};

export const pool = new Pool(poolConfig);

// Create drizzle instance with direct access (no wrapper)
export const db = drizzle({ client: pool, schema });

// Secure logging function that sanitizes database errors
function dbLog(level: 'info' | 'warn' | 'error', message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [DB-${level.toUpperCase()}] ${message}`);
  
  if (error) {
    // Sanitize error to prevent credential exposure
    const sanitizedError = {
      message: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN',
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      name: error.name,
      // Exclude any connection info, client, config, etc.
    };
    console.error('Error details:', sanitizedError);
  }
}

// Health check function for monitoring
export async function checkDbHealth(): Promise<{ connected: boolean; attempts: number; lastError?: string }> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { connected: true, attempts: connectionAttempts };
  } catch (error: any) {
    connectionAttempts++;
    return { 
      connected: false, 
      attempts: connectionAttempts,
      lastError: error.message 
    };
  }
}

// Basic error detection helper
export function isConnectionError(error: any): boolean {
  return (
    error?.code === '57P01' || // admin_shutdown
    error?.code === '08006' || // connection_failure
    error?.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
    error?.code === '08003' || // connection_does_not_exist
    error?.code === '08004' || // sqlserver_rejected_establishment_of_sqlconnection
    error?.message?.includes('terminating connection') ||
    error?.message?.includes('Connection terminated') ||
    error?.message?.includes('server closed the connection') ||
    error?.message?.includes('Connection refused') ||
    error?.message?.includes('timeout')
  );
}

// Pool error handling
pool.on('error', (err) => {
  dbLog('error', 'Database pool error', err);
});

pool.on('connect', () => {
  dbLog('info', 'New database connection established');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  dbLog('info', 'Gracefully shutting down database connections...');
  try {
    await pool.end();
    dbLog('info', 'Database connections closed');
  } catch (error) {
    dbLog('error', 'Error closing database connections', error);
  }
});

process.on('SIGINT', async () => {
  dbLog('info', 'Gracefully shutting down database connections...');
  try {
    await pool.end();
    dbLog('info', 'Database connections closed');
    process.exit(0);
  } catch (error) {
    dbLog('error', 'Error closing database connections', error);
    process.exit(1);
  }
});

dbLog('info', 'Database connection initialized with improved pool settings');