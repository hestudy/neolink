/**
 * Redis 缓存中间件
 */

import { Context, Next } from 'hono';
import { redisClient } from '../services/database';
import crypto from 'crypto';

export interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  skipCache?: boolean;
  keyGenerator?: (c: Context) => string;
  condition?: (c: Context) => boolean;
  cacheErrors?: boolean;
  errorTtl?: number;
}

/**
 * 生成默认缓存键
 */
function generateDefaultCacheKey(c: Context): string {
  const url = c.req.url;
  const method = c.req.method;
  const query = c.req.query();

  const keyData = `${method}:${url}:${JSON.stringify(query)}`;
  return crypto.createHash('md5').update(keyData).digest('hex');
}

export function cache(options: CacheOptions = {}) {
  const {
    ttl = 300,
    keyPrefix = 'api:cache:',
    skipCache = false,
    keyGenerator = generateDefaultCacheKey,
    condition = () => true,
    cacheErrors = false,
    errorTtl = 60,
  } = options;

  return async (c: Context, next: Next) => {
    if (skipCache || !condition(c) || c.req.method !== 'GET') {
      return await next();
    }

    try {
      const cacheKey = `${keyPrefix}${keyGenerator(c)}`;

      // 尝试从缓存获取数据
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        c.header('X-Cache', 'HIT');
        c.header('X-Cache-Key', cacheKey);
        return c.json(parsed.data, parsed.status);
      }

      // 缓存未命中
      c.header('X-Cache', 'MISS');
      c.header('X-Cache-Key', cacheKey);

      await next();

      // 缓存响应
      const response = c.res;
      const status = response.status;

      if (shouldCacheResponse(status, cacheErrors)) {
        const responseData = await response
          .clone()
          .json()
          .catch(() => null);

        if (responseData) {
          const cacheData = {
            data: responseData,
            status,
            timestamp: Date.now(),
          };

          const cacheTtl = isErrorResponse(status) ? errorTtl : ttl;
          await redisClient.setex(
            cacheKey,
            cacheTtl,
            JSON.stringify(cacheData)
          );
        }
      }
    } catch (error) {
      console.error('Cache middleware error:', error);
      await next();
    }
  };
}

function shouldCacheResponse(status: number, cacheErrors: boolean): boolean {
  if (status >= 200 && status < 300) return true;
  if (cacheErrors && isErrorResponse(status)) return true;
  return false;
}

function isErrorResponse(status: number): boolean {
  return status >= 400;
}

export function userCache(options: Omit<CacheOptions, 'keyPrefix'> = {}) {
  return cache({ ...options, keyPrefix: 'user-api' });
}

export function paginationCache(options: CacheOptions = {}) {
  return cache({ ...options, keyPrefix: 'pagination-api' });
}

export class CacheInvalidator {
  static async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(
          `Invalidated ${keys.length} cache keys matching pattern: ${pattern}`
        );
        return keys.length;
      }
      return 0;
    } catch (error) {
      console.error(`Error invalidating cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  static async invalidateKey(key: string): Promise<boolean> {
    try {
      const result = await redisClient.del(key);
      console.log(`Invalidated cache key: ${key}`);
      return result > 0;
    } catch (error) {
      console.error(`Error invalidating cache key ${key}:`, error);
      return false;
    }
  }

  static async invalidateUserCache(userId: string): Promise<number> {
    return this.invalidatePattern(`user-api:*:${userId}*`);
  }

  static async invalidateBookmarkCache(bookmarkId?: string): Promise<number> {
    if (bookmarkId) {
      return this.invalidatePattern(`*bookmarks*${bookmarkId}*`);
    } else {
      return this.invalidatePattern('*bookmarks*');
    }
  }

  static async invalidateTagCache(): Promise<number> {
    return this.invalidatePattern('*tags*');
  }

  static async clearAllCache(): Promise<number> {
    return this.invalidatePattern('api:cache:*');
  }
}

export const invalidateCache = CacheInvalidator.invalidatePattern;
export const invalidateKey = CacheInvalidator.invalidateKey;
export const invalidateUserCache = CacheInvalidator.invalidateUserCache;
export const invalidateBookmarkCache = CacheInvalidator.invalidateBookmarkCache;
export const invalidateTagCache = CacheInvalidator.invalidateTagCache;
export const clearAllCache = CacheInvalidator.clearAllCache;
