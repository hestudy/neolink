import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { setupMiddleware } from './index';

// Mock Redis for rate limiting tests
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

describe('Middleware Setup', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  it('should setup middleware without errors', () => {
    expect(() => setupMiddleware(app)).not.toThrow();
  });

  it('should handle CORS preflight requests', async () => {
    setupMiddleware(app);

    app.get('/test', (c) => c.json({ message: 'test' }));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    expect(res.status).toBe(204); // CORS preflight returns 204
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000'
    );
  });

  it('should reject requests with oversized payload', async () => {
    setupMiddleware(app);

    app.post('/test', (c) => c.json({ message: 'test' }));

    const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': largePayload.length.toString(),
      },
      body: largePayload,
    });

    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toBe('Payload Too Large');
  });

  it('should add security headers', async () => {
    setupMiddleware(app);

    app.get('/test', (c) => c.json({ message: 'test' }));

    const res = await app.request('/test');

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN'); // Hono's default
    expect(res.headers.get('X-XSS-Protection')).toBe('0'); // Modern browsers disable XSS protection
  });

  it('should handle CSRF protection for protected routes', async () => {
    setupMiddleware(app);

    app.post('/api/v1/protected', (c) => c.json({ message: 'protected' }));

    // 请求没有正确的 Origin 头部且使用表单 Content-Type 应该被拒绝
    const res = await app.request('/api/v1/protected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded', // 表单类型会触发 CSRF 检查
        Origin: 'http://malicious-site.com', // 不在允许的 origin 列表中
      },
      body: 'data=test',
    });

    expect(res.status).toBe(403); // CSRF protection should reject
  });

  it('should allow access to CSRF token endpoint', async () => {
    setupMiddleware(app);

    app.get('/csrf-token', (c) => {
      return c.json({
        message: 'CSRF protection is enabled via Origin header validation',
      });
    });

    const res = await app.request('/csrf-token');

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('message');
  });

  it('should allow requests with valid Origin header', async () => {
    setupMiddleware(app);

    app.post('/api/v1/protected', (c) => c.json({ message: 'protected' }));

    // 请求有正确的 Origin 头部应该被允许
    const res = await app.request('/api/v1/protected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000', // 在允许的 origin 列表中
      },
      body: JSON.stringify({ data: 'test' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('protected');
  });

  it('should skip CSRF protection for excluded paths', async () => {
    setupMiddleware(app);

    app.get('/health', (c) => c.json({ status: 'ok' }));
    app.post('/api/v1/auth/login', (c) => c.json({ message: 'login' }));

    // 健康检查路由应该不受 CSRF 保护
    const healthRes = await app.request('/health');
    expect(healthRes.status).toBe(200);

    // 登录路由应该不受 CSRF 保护
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'test', password: 'test' }),
    });
    expect(loginRes.status).toBe(200);
  });

  it('should add request ID to responses', async () => {
    setupMiddleware(app);

    app.get('/test', (c) => {
      const requestId = c.get('requestId');
      return c.json({ requestId });
    });

    const res = await app.request('/test');
    const data = await res.json();

    expect(data.requestId).toBeDefined();
    expect(typeof data.requestId).toBe('string');
    expect(data.requestId.length).toBeGreaterThan(0);
  });

  it('should apply rate limiting', async () => {
    setupMiddleware(app);

    app.get('/test', (c) => c.json({ message: 'test' }));

    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('should skip rate limiting for whitelisted IPs', async () => {
    setupMiddleware(app);

    app.get('/test', (c) => c.json({ message: 'test' }));

    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    expect(res.status).toBe(200);
    // Whitelisted IPs should not have rate limit headers
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
  });
});
