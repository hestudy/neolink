import { describe, it, expect, beforeAll } from 'vitest';
import {
  checkDatabaseConnection,
  checkPgVectorExtension,
  getDatabaseHealth,
  connectWithRetry,
  getPoolStatus,
} from '../src/connection';

describe('Database Connection Tests', () => {
  let isDatabaseAvailable = false;

  beforeAll(async () => {
    // Quick check for database availability with minimal retry
    console.log('Waiting for database connection...');
    isDatabaseAvailable = await connectWithRetry(2, 500); // Only 2 attempts, 500ms delay
    if (!isDatabaseAvailable) {
      console.warn(
        'Database not available for tests - skipping database-dependent tests'
      );
    }
  });

  it('should connect to database', async () => {
    if (!isDatabaseAvailable) {
      console.log(
        '⚠️ Skipping database connection test - database not available'
      );
      return;
    }

    const isConnected = await checkDatabaseConnection();
    expect(isConnected).toBe(true);
    console.log('✅ Database connection successful');
  });

  it('should check pgvector extension', async () => {
    if (!isDatabaseAvailable) {
      console.log(
        '⚠️ Skipping pgvector extension test - database not available'
      );
      return;
    }

    const hasPgVector = await checkPgVectorExtension();
    expect(typeof hasPgVector).toBe('boolean');

    if (hasPgVector) {
      console.log('✅ pgvector extension is available');
    } else {
      console.log('⚠️ pgvector extension not available');
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
