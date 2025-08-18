import { Context, Next, Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { csrf } from 'hono/csrf';
import { requestMonitoring, HealthMonitor } from './monitoring';
import { rateLimiters } from './rateLimit';

/**
 * 设置生产级中间件栈
 */
export function setupMiddleware(app: Hono | OpenAPIHono) {
  // 请求ID中间件 - 为每个请求生成唯一ID
  (app as Hono).use('*', requestId());

  // 安全头部中间件
  (app as Hono).use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
      crossOriginEmbedderPolicy: false, // 避免与某些API冲突
    })
  );

  // 请求监控中间件（包含详细日志和性能监控）
  (app as Hono).use('*', requestMonitoring());

  // 请求日志中间件
  (app as Hono).use(
    '*',
    logger((message, ...rest) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${message}`, ...rest);
    })
  );

  // 性能计时中间件
  (app as Hono).use('*', timing());

  // 速率限制中间件
  (app as Hono).use('*', rateLimiters.default); // 默认速率限制

  // CORS 配置
  const corsOrigins =
    process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'https://neolink.app']
      : ['http://localhost:3000', 'http://localhost:3001'];

  (app as Hono).use(
    '*',
    cors({
      origin: corsOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
        'X-CSRF-Token', // 添加 CSRF 令牌头部支持
      ],
      credentials: true,
      maxAge: 86400, // 24小时
    })
  );

  // CSRF 保护中间件 - 仅对需要保护的路由启用
  (app as Hono).use(
    '/api/v1/*',
    csrf({
      origin: corsOrigins,
    })
  );

  // 排除认证路由的 CSRF 保护
  (app as Hono).use('/api/v1/auth/*', async (_c: Context, next: Next) => {
    // 跳过 CSRF 检查，直接继续
    await next();
  });

  // JSON 格式化中间件（仅在开发环境）
  if (process.env.NODE_ENV !== 'production') {
    (app as Hono).use('*', prettyJSON());
  }

  // 请求体大小限制中间件
  (app as Hono).use('*', async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      // 10MB
      return c.json(
        {
          success: false,
          error: 'Payload Too Large',
          message: 'Request body exceeds maximum size limit',
        },
        413
      );
    }
    await next();
  });

  // 启动健康监控
  const healthMonitor = HealthMonitor.getInstance();
  // TODO: 实现健康监控的定期检查
  console.log('Health monitor initialized:', healthMonitor.getUptime());

  console.log('✅ Middleware stack configured');
}
