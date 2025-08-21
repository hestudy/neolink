import { OpenAPIHono } from '@hono/zod-openapi';
import {
  healthCheckRoute,
  rootInfoRoute,
  csrfTokenRoute,
  versionRoute,
} from './routes/system';
import {
  loginRoute as _loginRoute,
  registerRoute as _registerRoute,
  refreshTokenRoute as _refreshTokenRoute,
  logoutRoute as _logoutRoute,
  // getCurrentUserRoute, // implemented in routes/auth.ts
} from './routes/auth';

/**
 * 设置 OpenAPI 路由
 */
export function setupOpenAPIRoutes(app: OpenAPIHono) {
  // 系统路由
  app.openapi(rootInfoRoute, (c) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    return c.json({
      success: true,
      data: {
        name: 'NeoLink API Server',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        uptime: Math.floor(uptime),
        memory: {
          used: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
          total: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
          percentage:
            Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100,
        },
        timestamp: new Date().toISOString(),
      },
      requestId: c.get('requestId'),
    });
  });

  app.openapi(healthCheckRoute, (c) => {
    const uptime = process.uptime();

    return c.json(
      {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: 'connected', // TODO: 实际检查数据库连接
          redis: 'connected', // TODO: 实际检查 Redis 连接
        },
        requestId: c.get('requestId') || 'unknown',
      },
      200
    );
  });

  app.openapi(csrfTokenRoute, (c) => {
    return c.json({
      message: 'CSRF protection is enabled via Origin header validation',
      note: 'Include Origin header in your requests for CSRF protection',
    });
  });

  app.openapi(versionRoute, (c) => {
    return c.json({
      success: true,
      data: {
        api: '1.0.0',
        build: '2025.08.16.001',
        commit: process.env.GIT_COMMIT || 'unknown',
        buildDate: new Date().toISOString(),
        features: [
          'authentication',
          'rate-limiting',
          'monitoring',
          'openapi-docs',
          'csrf-protection',
          'cors',
          'validation',
        ],
      },
      requestId: c.get('requestId'),
    });
  });

  // 认证路由的OpenAPI定义仅用于文档生成
  // 实际的认证逻辑在 routes/auth.ts 中实现，这里不添加处理器

  console.log('✅ OpenAPI routes configured');
}
