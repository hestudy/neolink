import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Redis from 'ioredis';
import {
  redisClient,
  redisPool,
  checkRedisConnection,
  getRedisHealth,
} from './database';

// Mock Redis for testing
vi.mock('ioredis');

describe('Redis Connection Service', () => {
  beforeAll(() => {
    // Mock Redis methods
    const mockRedis = {
      ping: vi.fn(),
      info: vi.fn(),
      quit: vi.fn(),
    };

    vi.mocked(Redis).mockImplementation(() => mockRedis as unknown as Redis);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  describe('checkRedisConnection', () => {
    it('should return true when Redis responds with PONG', async () => {
      const mockPing = vi.fn().mockResolvedValue('PONG');
      (redisClient as unknown as { ping: typeof mockPing }).ping = mockPing;

      const result = await checkRedisConnection();

      expect(result).toBe(true);
      expect(mockPing).toHaveBeenCalledOnce();
    });

    it('should return false when Redis connection fails', async () => {
      const mockPing = vi
        .fn()
        .mockRejectedValue(new Error('Connection failed'));
      (redisClient as unknown as { ping: typeof mockPing }).ping = mockPing;

      const result = await checkRedisConnection();

      expect(result).toBe(false);
      expect(mockPing).toHaveBeenCalledOnce();
    });

    it('should return false when Redis responds with unexpected value', async () => {
      const mockPing = vi.fn().mockResolvedValue('UNEXPECTED');
      (redisClient as unknown as { ping: typeof mockPing }).ping = mockPing;

      const result = await checkRedisConnection();

      expect(result).toBe(false);
      expect(mockPing).toHaveBeenCalledOnce();
    });
  });

  describe('getRedisHealth', () => {
    it('should return healthy status with metrics', async () => {
      const mockPing = vi.fn().mockResolvedValue('PONG');
      const mockInfo = vi
        .fn()
        .mockResolvedValue('used_memory_human:1.5M\r\nother_info:value');
      (
        redisClient as unknown as {
          ping: typeof mockPing;
          info: typeof mockInfo;
        }
      ).ping = mockPing;
      (
        redisClient as unknown as {
          ping: typeof mockPing;
          info: typeof mockInfo;
        }
      ).info = mockInfo;

      const result = await getRedisHealth();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeTypeOf('number');
      expect(result.memoryUsage).toBe('1.5M');
      expect(result.poolStats).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status when Redis fails', async () => {
      const mockPing = vi.fn().mockRejectedValue(new Error('Redis down'));
      (redisClient as unknown as { ping: typeof mockPing }).ping = mockPing;

      const result = await getRedisHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Redis down');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Redis Connection Pool', () => {
    it('should provide pool statistics', () => {
      const stats = redisPool.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('available');
      expect(stats).toHaveProperty('used');
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.available).toBe('number');
      expect(typeof stats.used).toBe('number');
    });

    it('should get and release connections', async () => {
      const connection = await redisPool.getConnection();
      expect(connection).toBeDefined();

      const statsBefore = redisPool.getStats();
      redisPool.releaseConnection(connection);
      const statsAfter = redisPool.getStats();

      expect(statsAfter.available).toBeGreaterThan(statsBefore.available);
      expect(statsAfter.used).toBeLessThan(statsBefore.used);
    });
  });
});
