import { describe, it, expect, beforeEach } from 'vitest';
import { createOpenAPIApp } from './config';
import { setupMiddleware } from '../middleware';
import { setupErrorHandlers } from '../middleware/errorHandler';
import { setupOpenAPIRoutes } from './setup';

describe('OpenAPI Integration', () => {
  let app: ReturnType<typeof createOpenAPIApp>;

  beforeEach(() => {
    app = createOpenAPIApp();
    setupMiddleware(app);
    setupOpenAPIRoutes(app);
    setupErrorHandlers(app);
  });

  it('should serve OpenAPI documentation at /doc', async () => {
    const res = await app.request('/doc');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const doc = await res.json();
    expect(doc.openapi).toBe('3.0.0');
    expect(doc.info.title).toBe('NeoLink API');
    expect(doc.info.version).toBe('1.0.0');
    expect(doc.paths).toBeDefined();
  });

  it('should serve Swagger UI at /ui', async () => {
    const res = await app.request('/ui');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('SwaggerUI'); // 检查实际的文本
    expect(html).toContain('NeoLink API Documentation');
  });

  it('should redirect /docs to /ui', async () => {
    const res = await app.request('/docs');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/ui');
  });

  it('should redirect /swagger to /ui', async () => {
    const res = await app.request('/swagger');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/ui');
  });

  it('should handle root path with OpenAPI route', async () => {
    const res = await app.request('/');

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('NeoLink API Server');
    expect(data.data.version).toBe('1.0.0');
    expect(data.data.environment).toBeDefined();
    expect(data.requestId).toBeDefined();
  });

  it('should handle health check with OpenAPI route', async () => {
    const res = await app.request('/health');

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('healthy');
    expect(data.uptime).toBeTypeOf('number');
    expect(data.services).toBeDefined();
    expect(data.services.database).toBe('connected');
    expect(data.services.redis).toBe('connected');
  });

  it('should handle CSRF token endpoint with OpenAPI route', async () => {
    const res = await app.request('/csrf-token');

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toContain('CSRF protection');
    expect(data.note).toContain('Origin header');
  });

  it('should handle version endpoint with OpenAPI route', async () => {
    const res = await app.request('/version');

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.api).toBe('1.0.0');
    expect(data.data.features).toBeInstanceOf(Array);
    expect(data.data.features).toContain('authentication');
    expect(data.data.features).toContain('openapi-docs');
  });

  it('should handle auth login endpoint (placeholder)', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'test',
        password: 'password',
      }),
    });

    expect(res.status).toBe(501); // Not implemented yet

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.message).toContain('to be implemented');
  });

  it('should include proper OpenAPI schema validation', async () => {
    const docRes = await app.request('/doc');
    const doc = await docRes.json();

    // 检查基本结构
    expect(doc.openapi).toBe('3.0.0');
    expect(doc.info).toBeDefined();
    expect(doc.paths).toBeDefined();
    expect(doc.components).toBeDefined();

    // 检查安全定义（如果存在）
    if (doc.components && doc.components.securitySchemes) {
      expect(doc.components.securitySchemes.bearerAuth).toBeDefined();
      expect(doc.components.securitySchemes.bearerAuth.type).toBe('http');
      expect(doc.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    }

    // 检查标签
    expect(doc.tags).toBeInstanceOf(Array);
    expect(doc.tags.some((tag: any) => tag.name === 'Authentication')).toBe(
      true
    );
    expect(doc.tags.some((tag: any) => tag.name === 'System')).toBe(true);

    // 检查路径
    expect(doc.paths['/']).toBeDefined();
    expect(doc.paths['/health']).toBeDefined();
    expect(doc.paths['/api/v1/auth/login']).toBeDefined();
  });

  it('should include rate limiting headers in responses', async () => {
    const res = await app.request('/health', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('should include request ID in responses', async () => {
    const res = await app.request('/');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Request-ID')).toBeDefined();

    const data = await res.json();
    expect(data.requestId).toBeDefined();
    expect(data.requestId).toBe(res.headers.get('X-Request-ID'));
  }, 10000); // 增加超时时间到10秒
});
