import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Database connection configuration
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neolink:neolink_password@localhost:5432/neolink';

// Create connection pool with optimized settings
const pool = new Pool({
  connectionString,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 2000, // 2 seconds connection timeout
  allowExitOnIdle: true, // Allow process to exit when all connections are idle
});

// Pool event handlers for monitoring
pool.on('connect', () => {
  console.log('Database client connected');
});

pool.on('error', (err: Error) => {
  console.error('Database pool error:', err);
});

// Create Drizzle database instance
export const db = drizzle(pool, { schema });

// Enhanced health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Check pgvector extension
export async function checkPgVectorExtension(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
    );
    client.release();
    return result.rows.length > 0;
  } catch (error) {
    console.error('pgvector extension check failed:', error);
    return false;
  }
}

// Get connection pool status
export function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

// Enhanced health check with detailed information
export async function getDatabaseHealth() {
  const isConnected = await checkDatabaseConnection();
  const hasPgVector = await checkPgVectorExtension();
  const poolStatus = getPoolStatus();

  return {
    connected: isConnected,
    pgvectorEnabled: hasPgVector,
    pool: poolStatus,
    timestamp: new Date().toISOString(),
  };
}

// Connection retry mechanism
export async function connectWithRetry(
  maxRetries = 5,
  delay = 1000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const isConnected = await checkDatabaseConnection();
    if (isConnected) {
      console.log(`Database connected on attempt ${attempt}`);
      return true;
    }

    if (attempt < maxRetries) {
      console.log(
        `Database connection attempt ${attempt} failed, retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  console.error(`Failed to connect to database after ${maxRetries} attempts`);
  return false;
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('Database connection pool closed');
}
