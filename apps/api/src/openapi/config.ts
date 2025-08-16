import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { z } from '@hono/zod-openapi';

/**
 * OpenAPI 配置
 */
export const openApiConfig = {
  openapi: '3.0.0',
  info: {
    title: 'NeoLink API',
    version: '1.0.0',
    description: `
# NeoLink API 文档

NeoLink 是一个现代化的全栈应用程序，提供强大的 API 服务。

## 特性

- 🔐 **JWT 身份认证** - 安全的用户认证和授权
- 🛡️ **速率限制** - 基于 Redis 的智能速率限制
- 📊 **请求监控** - 实时性能监控和日志记录
- 🔒 **CSRF 保护** - 跨站请求伪造防护
- ✅ **数据验证** - 基于 Zod 的类型安全验证
- 📚 **类型安全** - 完整的 TypeScript 支持
- 🚀 **高性能** - 基于 Hono.js 的轻量级框架

## 认证

大多数 API 端点需要 JWT 令牌认证。在请求头中包含：

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## 速率限制

API 实施了多层级的速率限制：

- **默认用户**: 每分钟 100 个请求
- **认证用户**: 每分钟 300 个请求  
- **认证操作**: 每小时 5 个请求（登录、注册等）

## 错误处理

所有错误响应都遵循统一的格式：

\`\`\`json
{
  "success": false,
  "error": "错误类型",
  "message": "详细错误信息",
  "timestamp": "2025-08-16T15:00:00.000Z",
  "requestId": "uuid"
}
\`\`\`
    `,
    contact: {
      name: 'NeoLink Team',
      email: 'support@neolink.app',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: '开发环境',
    },
    {
      url: 'https://api.neolink.app',
      description: '生产环境',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: '用户认证相关接口',
    },
    {
      name: 'System',
      description: '系统状态和健康检查',
    },
    {
      name: 'Security',
      description: '安全相关接口',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT 令牌认证',
      },
    },
    schemas: {},
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

/**
 * 通用响应 Schema
 */
export const CommonResponseSchemas = {
  // 成功响应
  Success: z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: '操作成功' }),
    timestamp: z.string().openapi({ example: '2025-08-16T15:00:00.000Z' }),
    requestId: z.string().openapi({ example: 'uuid-request-id' }),
  }),

  // 错误响应
  Error: z.object({
    success: z.boolean().openapi({ example: false }),
    error: z.string().openapi({ example: 'Validation Error' }),
    message: z.string().openapi({ example: '请求参数验证失败' }),
    details: z
      .any()
      .optional()
      .openapi({ example: { field: 'error details' } }),
    timestamp: z.string().openapi({ example: '2025-08-16T15:00:00.000Z' }),
    requestId: z.string().openapi({ example: 'uuid-request-id' }),
  }),

  // 分页响应
  Pagination: z.object({
    page: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 20 }),
    total: z.number().openapi({ example: 100 }),
    totalPages: z.number().openapi({ example: 5 }),
  }),
};

/**
 * 通用参数 Schema
 */
export const CommonParamSchemas = {
  // ID 参数
  Id: z.object({
    id: z
      .string()
      .min(1)
      .openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: '资源唯一标识符',
      }),
  }),

  // 分页查询参数
  Pagination: z.object({
    page: z
      .string()
      .optional()
      .openapi({
        param: {
          name: 'page',
          in: 'query',
        },
        example: '1',
        description: '页码，从 1 开始',
      }),
    limit: z
      .string()
      .optional()
      .openapi({
        param: {
          name: 'limit',
          in: 'query',
        },
        example: '20',
        description: '每页数量，最大 100',
      }),
  }),
};

/**
 * 创建 OpenAPI Hono 应用实例
 */
export function createOpenAPIApp() {
  const app = new OpenAPIHono();

  // 添加 OpenAPI 文档端点
  app.doc('/doc', openApiConfig);

  // 添加 Swagger UI 界面
  app.get(
    '/ui',
    swaggerUI({
      url: '/doc',
      title: 'NeoLink API Documentation',
      theme: 'dark',
      layout: 'StandaloneLayout',
      deepLinking: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      requestInterceptor: (request) => {
        // 自动添加认证头部
        const token = localStorage.getItem('auth-token');
        if (token) {
          request.headers['Authorization'] = `Bearer ${token}`;
        }
        return request;
      },
    })
  );

  // 添加 API 文档重定向
  app.get('/docs', (c) => c.redirect('/ui'));
  app.get('/swagger', (c) => c.redirect('/ui'));

  return app;
}

/**
 * 创建带有 OpenAPI 支持的路由
 */
export function createRoute(
  config: Parameters<typeof import('@hono/zod-openapi').createRoute>[0]
) {
  return import('@hono/zod-openapi').then(({ createRoute }) =>
    createRoute(config)
  );
}

/**
 * 导出 z 对象用于 Schema 定义
 */
export { z };
