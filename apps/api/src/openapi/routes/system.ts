import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { CommonResponseSchemas } from '../config';

/**
 * 健康检查响应 Schema
 */
const HealthCheckSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    status: z.string().openapi({ example: 'healthy' }),
    timestamp: z.string().openapi({ example: '2025-08-16T15:00:00.000Z' }),
    uptime: z.number().openapi({ example: 3600 }),
    version: z.string().openapi({ example: '1.0.0' }),
    environment: z.string().openapi({ example: 'development' }),
    services: z.object({
      database: z.string().openapi({ example: 'connected' }),
      redis: z.string().openapi({ example: 'connected' }),
    }),
    requestId: z.string().openapi({ example: 'uuid-request-id' }),
  })
  .openapi('HealthCheck');

/**
 * 系统信息响应 Schema
 */
const SystemInfoSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    data: z.object({
      name: z.string().openapi({ example: 'NeoLink API Server' }),
      version: z.string().openapi({ example: '1.0.0' }),
      environment: z.string().openapi({ example: 'development' }),
      nodeVersion: z.string().openapi({ example: 'v18.17.0' }),
      platform: z.string().openapi({ example: 'darwin' }),
      uptime: z.number().openapi({ example: 3600 }),
      memory: z.object({
        used: z.number().openapi({ example: 50.5 }),
        total: z.number().openapi({ example: 100.0 }),
        percentage: z.number().openapi({ example: 50.5 }),
      }),
      timestamp: z.string().openapi({ example: '2025-08-16T15:00:00.000Z' }),
    }),
    requestId: z.string().openapi({ example: 'uuid-request-id' }),
  })
  .openapi('SystemInfo');

/**
 * 健康检查路由
 */
export const healthCheckRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: '健康检查',
  description: '检查 API 服务器和相关服务的健康状态',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthCheckSchema,
        },
      },
      description: '服务健康状态',
    },
    503: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '服务不可用',
    },
  },
});

/**
 * 根路径信息路由
 */
export const rootInfoRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'API 基本信息',
  description: '获取 API 服务器的基本信息',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SystemInfoSchema,
        },
      },
      description: 'API 基本信息',
    },
  },
});

/**
 * CSRF 令牌路由
 */
export const csrfTokenRoute = createRoute({
  method: 'get',
  path: '/csrf-token',
  tags: ['Security'],
  summary: '获取 CSRF 令牌信息',
  description: '获取 CSRF 保护机制的相关信息',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({
              example:
                'CSRF protection is enabled via Origin header validation',
            }),
            note: z.string().openapi({
              example:
                'Include Origin header in your requests for CSRF protection',
            }),
          }),
        },
      },
      description: 'CSRF 保护信息',
    },
  },
});

/**
 * API 版本信息路由
 */
export const versionRoute = createRoute({
  method: 'get',
  path: '/version',
  tags: ['System'],
  summary: 'API 版本信息',
  description: '获取详细的 API 版本和构建信息',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.object({
              api: z.string().openapi({ example: '1.0.0' }),
              build: z.string().openapi({ example: '2025.08.16.001' }),
              commit: z.string().openapi({ example: 'abc123def456' }),
              buildDate: z
                .string()
                .openapi({ example: '2025-08-16T15:00:00.000Z' }),
              features: z.array(z.string()).openapi({
                example: ['authentication', 'rate-limiting', 'monitoring'],
              }),
            }),
            requestId: z.string().openapi({ example: 'uuid-request-id' }),
          }),
        },
      },
      description: 'API 版本信息',
    },
  },
});
