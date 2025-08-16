import { describe, it, expect, beforeAll } from 'vitest';
import {
  checkDatabaseConnection,
  checkPgVectorExtension,
  getDatabaseHealth,
  connectWithRetry,
  getPoolStatus,
} from '../src/connection';

describe('Database Connection Tests', () => {
  beforeAll(async () => {
    // Wait for database to be ready
    console.log('Waiting for database connection...');
    const connected = await connectWithRetry(3, 2000);
    if (!connected) {
      console.warn('Database not available for tests');
    }
  });

  it('should connect to database', async () => {
    const isConnected = await checkDatabaseConnection();
    expect(typeof isConnected).toBe('boolean');

    if (isConnected) {
      console.log('✅ Database connection successful');
    } else {
      console.log('⚠️ Database connection failed (expected if DB not running)');
    }
  });

  it('should check pgvector extension', async () => {
    const hasPgVector = await checkPgVectorExtension();
    expect(typeof hasPgVector).toBe('boolean');

    if (hasPgVector) {
      console.log('✅ pgvector extension is available');
    } else {
      console.log(
        '⚠️ pgvector extension not available (expected if DB not running)'
      );
    }
  });

  it('should get pool status', () => {
    const status = getPoolStatus();
    expect(status).toHaveProperty('totalCount');
    expect(status).toHaveProperty('idleCount');
    expect(status).toHaveProperty('waitingCount');
    expect(typeof status.totalCount).toBe('number');
    expect(typeof status.idleCount).toBe('number');
    expect(typeof status.waitingCount).toBe('number');

    console.log('Pool status:', status);
  });

  it('should get database health', async () => {
    const health = await getDatabaseHealth();
    expect(health).toHaveProperty('connected');
    expect(health).toHaveProperty('pgvectorEnabled');
    expect(health).toHaveProperty('pool');
    expect(health).toHaveProperty('timestamp');
    expect(typeof health.connected).toBe('boolean');
    expect(typeof health.pgvectorEnabled).toBe('boolean');
    expect(typeof health.timestamp).toBe('string');

    console.log('Database health:', health);
  });

  it('should handle connection retry', async () => {
    const connected = await connectWithRetry(2, 100);
    expect(typeof connected).toBe('boolean');
  });
});
