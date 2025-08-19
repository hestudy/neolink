import crypto from 'crypto';

export interface CacheOptions {
  ttl: number; // Time to live in seconds
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  generateCacheKey(
    operation: string,
    content: string,
    options: unknown
  ): string;
}

export class MemoryCacheService implements CacheService {
  private cache = new Map<string, { value: unknown; expires: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item || item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + options.ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  generateCacheKey(
    operation: string,
    content: string,
    options: unknown
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${operation}:${content}:${JSON.stringify(options)}`)
      .digest('hex');
    return `ai_cache:${operation}:${hash}`;
  }
}
