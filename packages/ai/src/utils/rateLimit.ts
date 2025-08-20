import type { RateLimitRule, RateLimitExceededError } from '../types';

export interface RateLimitStorage {
  getRequests(key: string, windowStart: number): Promise<number>;
  addRequest(key: string, timestamp: number, ttl: number): Promise<void>;
  cleanExpiredRequests(key: string, windowStart: number): Promise<void>;
}

export class MemoryRateLimitStorage implements RateLimitStorage {
  private requests = new Map<string, number[]>();

  async getRequests(key: string, windowStart: number): Promise<number> {
    const timestamps = this.requests.get(key) || [];
    const validRequests = timestamps.filter((ts) => ts >= windowStart);
    this.requests.set(key, validRequests);
    return validRequests.length;
  }

  async addRequest(key: string, timestamp: number, ttl: number): Promise<void> {
    const timestamps = this.requests.get(key) || [];
    timestamps.push(timestamp);
    this.requests.set(key, timestamps);

    // Clean up expired entries periodically
    if (timestamps.length % 10 === 0) {
      const cutoff = Date.now() - ttl;
      const validRequests = timestamps.filter((ts) => ts >= cutoff);
      this.requests.set(key, validRequests);
    }
  }

  async cleanExpiredRequests(key: string, windowStart: number): Promise<void> {
    const timestamps = this.requests.get(key) || [];
    const validRequests = timestamps.filter((ts) => ts >= windowStart);
    this.requests.set(key, validRequests);
  }
}

export class RateLimitService {
  private storage: RateLimitStorage;
  private rules: Map<string, RateLimitRule>;

  constructor(storage: RateLimitStorage, rules: Record<string, RateLimitRule>) {
    this.storage = storage;
    this.rules = new Map(Object.entries(rules));
  }

  async checkRateLimit(identifier: string, operation: string): Promise<void> {
    // Input validation
    if (!identifier?.trim()) {
      throw new Error('Identifier is required for rate limiting');
    }

    if (!operation?.trim()) {
      throw new Error('Operation is required for rate limiting');
    }

    const rule = this.rules.get(operation);
    if (!rule) {
      // No rate limit rule defined for this operation
      return;
    }

    const key = `rate_limit:${operation}:${identifier}`;
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    // Clean up expired requests
    await this.storage.cleanExpiredRequests(key, windowStart);

    // Get current request count within the window
    const currentRequests = await this.storage.getRequests(key, windowStart);

    if (currentRequests >= rule.maxRequests) {
      const error = new Error(
        `Rate limit exceeded for ${operation}. Maximum ${rule.maxRequests} requests per ${rule.windowMs}ms`
      ) as RateLimitExceededError;
      error.name = 'RateLimitExceededError';
      throw error;
    }

    // Record current request
    await this.storage.addRequest(key, now, rule.windowMs);
  }

  async getRateLimitStatus(
    identifier: string,
    operation: string
  ): Promise<{
    requests: number;
    limit: number;
    remaining: number;
    resetTime: Date;
  } | null> {
    const rule = this.rules.get(operation);
    if (!rule) {
      return null;
    }

    const key = `rate_limit:${operation}:${identifier}`;
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    await this.storage.cleanExpiredRequests(key, windowStart);
    const currentRequests = await this.storage.getRequests(key, windowStart);

    return {
      requests: currentRequests,
      limit: rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - currentRequests),
      resetTime: new Date(now + rule.windowMs),
    };
  }

  updateRules(newRules: Record<string, RateLimitRule>): void {
    this.rules.clear();
    Object.entries(newRules).forEach(([operation, rule]) => {
      this.rules.set(operation, rule);
    });
  }

  getRules(): Record<string, RateLimitRule> {
    return Object.fromEntries(this.rules);
  }
}
