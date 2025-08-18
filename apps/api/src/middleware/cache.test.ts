import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Context } from 'hono';

// Mock Redis client
vi.mock('../services/database', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

import { cache, CacheInvalidator } from './cache';
import { redisClient } from '../services/database';

describe('Cache Middleware', () => {
  let mockContext: Partial<Context>;
  let mockNext: ReturnType<typeof vi.fn>;
  const mockRedisClient = redisClient as unknown as typeof redisClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNext = vi.fn();
    mockContext = {
      req: {
        method: 'GET',
        url: 'https://api.example.com/test',
        query: vi.fn().mockReturnValue({}),
      },
      res: {
        status: 200,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({ data: 'test' }),
        }),
      },
      header: vi.fn(),
      json: vi.fn(),
    } as unknown as Context;
  });

  describe('cache function', () => {
    it('should skip caching for non-GET requests', async () => {
      mockContext.req!.method = 'POST';

      const middleware = cache();
      await middleware(mockContext as Context, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should skip caching when skipCache is true', async () => {
      const middleware = cache({ skipCache: true });
      await middleware(mockContext as Context, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should return cached data when cache hit', async () => {
      const cachedData = JSON.stringify({
        data: { message: 'cached' },
        status: 200,
        timestamp: Date.now(),
      });

      mockRedisClient.get.mockResolvedValue(cachedData);

      const middleware = cache();
      await middleware(mockContext as Context, mockNext);

      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockContext.header).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(mockContext.json).toHaveBeenCalledWith({ message: 'cached' }, 200);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should cache response on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const middleware = cache({ ttl: 600 });
      await middleware(mockContext as Context, mockNext);

      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockContext.header).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        600,
        expect.any(String)
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection failed')
      );

      const middleware = cache();
      await middleware(mockContext as Context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const customKeyGenerator = vi.fn().mockReturnValue('custom-key');
      mockRedisClient.get.mockResolvedValue(null);

      const middleware = cache({ keyGenerator: customKeyGenerator });
      await middleware(mockContext as Context, mockNext);

      expect(customKeyGenerator).toHaveBeenCalledWith(mockContext);
      expect(mockRedisClient.get).toHaveBeenCalledWith('api:cache:custom-key');
    });

    it('should respect condition function', async () => {
      const condition = vi.fn().mockReturnValue(false);

      const middleware = cache({ condition });
      await middleware(mockContext as Context, mockNext);

      expect(condition).toHaveBeenCalledWith(mockContext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should cache error responses when cacheErrors is true', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockContext.res!.status = 404;

      const middleware = cache({ cacheErrors: true, errorTtl: 30 });
      await middleware(mockContext as Context, mockNext);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        30,
        expect.any(String)
      );
    });

    it('should not cache error responses when cacheErrors is false', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockContext.res!.status = 500;

      const middleware = cache({ cacheErrors: false });
      await middleware(mockContext as Context, mockNext);

      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });
  });

  describe('CacheInvalidator', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('invalidatePattern', () => {
      it('should invalidate keys matching pattern', async () => {
        const keys = ['key1', 'key2', 'key3'];
        mockRedisClient.keys.mockResolvedValue(keys);
        mockRedisClient.del.mockResolvedValue(3);

        const result = await CacheInvalidator.invalidatePattern('test:*');

        expect(mockRedisClient.keys).toHaveBeenCalledWith('test:*');
        expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
        expect(result).toBe(3);
      });

      it('should return 0 when no keys match pattern', async () => {
        mockRedisClient.keys.mockResolvedValue([]);

        const result = await CacheInvalidator.invalidatePattern('test:*');

        expect(mockRedisClient.keys).toHaveBeenCalledWith('test:*');
        expect(mockRedisClient.del).not.toHaveBeenCalled();
        expect(result).toBe(0);
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

        const result = await CacheInvalidator.invalidatePattern('test:*');

        expect(result).toBe(0);
      });
    });

    describe('invalidateKey', () => {
      it('should invalidate single key successfully', async () => {
        mockRedisClient.del.mockResolvedValue(1);

        const result = await CacheInvalidator.invalidateKey('test:key');

        expect(mockRedisClient.del).toHaveBeenCalledWith('test:key');
        expect(result).toBe(true);
      });

      it('should return false when key does not exist', async () => {
        mockRedisClient.del.mockResolvedValue(0);

        const result = await CacheInvalidator.invalidateKey('nonexistent');

        expect(result).toBe(false);
      });

      it('should handle Redis errors gracefully', async () => {
        mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

        const result = await CacheInvalidator.invalidateKey('test:key');

        expect(result).toBe(false);
      });
    });

    describe('invalidateUserCache', () => {
      it('should invalidate user-specific cache', async () => {
        mockRedisClient.keys.mockResolvedValue(['user-api:123:data']);
        mockRedisClient.del.mockResolvedValue(1);

        const result = await CacheInvalidator.invalidateUserCache('123');

        expect(mockRedisClient.keys).toHaveBeenCalledWith('user-api:*:123*');
        expect(result).toBe(1);
      });
    });

    describe('invalidateBookmarkCache', () => {
      it('should invalidate specific bookmark cache', async () => {
        mockRedisClient.keys.mockResolvedValue(['api:bookmarks:456']);
        mockRedisClient.del.mockResolvedValue(1);

        const result = await CacheInvalidator.invalidateBookmarkCache('456');

        expect(mockRedisClient.keys).toHaveBeenCalledWith('*bookmarks*456*');
        expect(result).toBe(1);
      });

      it('should invalidate all bookmark cache when no ID provided', async () => {
        mockRedisClient.keys.mockResolvedValue(['api:bookmarks:list']);
        mockRedisClient.del.mockResolvedValue(1);

        const result = await CacheInvalidator.invalidateBookmarkCache();

        expect(mockRedisClient.keys).toHaveBeenCalledWith('*bookmarks*');
        expect(result).toBe(1);
      });
    });

    describe('clearAllCache', () => {
      it('should clear all API cache', async () => {
        mockRedisClient.keys.mockResolvedValue([
          'api:cache:key1',
          'api:cache:key2',
        ]);
        mockRedisClient.del.mockResolvedValue(2);

        const result = await CacheInvalidator.clearAllCache();

        expect(mockRedisClient.keys).toHaveBeenCalledWith('api:cache:*');
        expect(result).toBe(2);
      });
    });
  });
});
