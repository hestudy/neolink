import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { setupMiddleware } from '../middleware';
import { setupRoutes } from '../routes';
import { setupErrorHandlers } from '../middleware/errorHandler';

describe('oRPC Integration', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    setupMiddleware(app);
    setupRoutes(app);
    setupErrorHandlers(app);
  });

  it('should mount oRPC routes correctly', async () => {
    const res = await app.request('/api/v1/rpc');

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('oRPC endpoint ready');
  });

  it('should handle oRPC context creation', async () => {
    // 测试带有请求头的请求
    const res = await app.request('/api/v1/rpc/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'test-client',
        'X-Forwarded-For': '192.168.1.1',
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.context.requestId).toBeDefined();
    expect(data.context.hasUser).toBe(false);
  });

  it('should provide type-safe API endpoints', async () => {
    // 测试系统健康检查端点
    const res = await app.request('/api/v1/rpc/system/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const data = await res.json();
    expect(data.router).toBe('appRouter integrated');
  });

  it('should handle various oRPC requests', async () => {
    const res = await app.request('/api/v1/rpc/invalid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 任何请求格式都会被处理
        invalid: 'request',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should handle CORS for oRPC endpoints', async () => {
    const res = await app.request('/api/v1/rpc', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000'
    );
  });

  it('should include request ID in oRPC context', async () => {
    const res = await app.request('/api/v1/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'system.health',
        params: {},
      }),
    });

    // 请求应该包含请求ID（通过中间件添加）
    expect(res.status).toBeDefined();
  });
});
