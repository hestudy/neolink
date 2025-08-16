import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { createRateLimit, closeRedis } from './rateLimit';
import { setupErrorHandlers } from './errorHandler';

// Mock Redis
vi.mock('ioredis', () => {
  const mockRedis = {
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zadd: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(() =>
        Promise.resolve([
          [null, 'OK'],
          [null, 0], // current count
          [null, 1],
          [null, 1],
        ])
      ),
    })),
    zrem: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
  };

  return {
    default: vi.fn(() => mockRedis),
  };
});

describe('Rate Limit Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    setupErrorHandlers(app);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await closeRedis();
  });

  it('should allow requests within rate limit', async () => {
    app.use('/test', createRateLimit('default'));
    app.get('/test', (c) => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('should block requests exceeding rate limit', async () => {
    // Mock Redis to return high count
    const mockRedis = await import('ioredis');
    const mockPipeline = {
      zremrangebyscore: vi.fn(),
      zcard: vi.fn(),
      zadd: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(() =>
        Promise.resolve([
          [null, 'OK'],
          [null, 100], // current count at limit
          [null, 1],
          [null, 1],
        ])
      ),
    };

    vi.mocked(mockRedis.default).mockImplementation(
      () =>
        ({
          pipeline: () => mockPipeline,
          zrem: vi.fn(),
          on: vi.fn(),
          quit: vi.fn(),
        }) as any
    );

    app.use('/test', createRateLimit('default'));
    app.get('/test', (c) => c.json({ message: 'success' }));

    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeDefined();

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Too Many Requests');
  });

  it('should allow whitelisted IPs', async () => {
    app.use('/test', createRateLimit('strict'));
    app.get('/test', (c) => c.json({ message: 'success' }));

    // Test localhost (whitelisted)
    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    expect(res.status).toBe(200);
    // Should not have rate limit headers for whitelisted IPs
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('should use different limits for different tiers', async () => {
    const defaultLimit = createRateLimit('default');
    const strictLimit = createRateLimit('strict');

    app.use('/default', defaultLimit);
    app.use('/strict', strictLimit);
    app.get('/default', (c) => c.json({ message: 'default' }));
    app.get('/strict', (c) => c.json({ message: 'strict' }));

    const defaultRes = await app.request('/default');
    const strictRes = await app.request('/strict');

    expect(defaultRes.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(strictRes.headers.get('X-RateLimit-Limit')).toBe('10');
  });

  it('should handle Redis connection errors gracefully', async () => {
    // Mock Redis to throw error
    const mockRedis = await import('ioredis');
    vi.mocked(mockRedis.default).mockImplementation(
      () =>
        ({
          pipeline: () => ({
            zremrangebyscore: vi.fn(),
            zcard: vi.fn(),
            zadd: vi.fn(),
            expire: vi.fn(),
            exec: vi.fn(() =>
              Promise.reject(new Error('Redis connection failed'))
            ),
          }),
          zrem: vi.fn(),
          on: vi.fn(),
          quit: vi.fn(),
        }) as any
    );

    app.use('/test', createRateLimit('default'));
    app.get('/test', (c) => c.json({ message: 'success' }));

    const res = await app.request('/test');

    // Should allow request when Redis fails (graceful degradation)
    expect(res.status).toBe(200);
  });

  it('should use custom configuration', async () => {
    const customLimit = createRateLimit('default', {
      maxRequests: 50,
      message: 'Custom rate limit message',
    });

    app.use('/test', customLimit);
    app.get('/test', (c) => c.json({ message: 'success' }));

    const res = await app.request('/test');

    expect(res.headers.get('X-RateLimit-Limit')).toBe('50');
  });

  it('should identify authenticated users correctly', async () => {
    app.use('/test', (c, next) => {
      // Mock authenticated user
      c.set('user', { id: 'user123', username: 'testuser' });
      return next();
    });
    app.use('/test', createRateLimit('authenticated'));
    app.get('/test', (c) => c.json({ message: 'success' }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('300');
  });

  it('should handle different IP header formats', async () => {
    app.use('/test', createRateLimit('default'));
    app.get('/test', (c) => c.json({ message: 'success' }));

    // Test x-real-ip header
    const res1 = await app.request('/test', {
      headers: { 'x-real-ip': '192.168.1.2' },
    });

    // Test x-forwarded-for with multiple IPs
    const res2 = await app.request('/test', {
      headers: { 'x-forwarded-for': '192.168.1.3, 10.0.0.1' },
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
