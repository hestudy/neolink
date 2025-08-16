import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { CommonResponseSchemas } from '../config';

/**
 * 用户 Schema
 */
const UserSchema = z
  .object({
    id: z.string().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    username: z.string().openapi({ example: 'john_doe' }),
    email: z.string().email().openapi({ example: 'john@example.com' }),
    role: z.string().openapi({ example: 'user' }),
    createdAt: z.string().openapi({ example: '2025-08-16T15:00:00.000Z' }),
    updatedAt: z.string().openapi({ example: '2025-08-16T15:00:00.000Z' }),
  })
  .openapi('User');

/**
 * 登录请求 Schema
 */
const LoginRequestSchema = z
  .object({
    username: z.string().min(3).max(50).openapi({
      example: 'john_doe',
      description: '用户名或邮箱地址',
    }),
    password: z.string().min(6).openapi({
      example: 'password123',
      description: '用户密码',
    }),
    rememberMe: z.boolean().optional().openapi({
      example: false,
      description: '是否记住登录状态',
    }),
  })
  .openapi('LoginRequest');

/**
 * 注册请求 Schema
 */
const RegisterRequestSchema = z
  .object({
    username: z.string().min(3).max(50).openapi({
      example: 'john_doe',
      description: '用户名，3-50个字符',
    }),
    email: z.string().email().openapi({
      example: 'john@example.com',
      description: '邮箱地址',
    }),
    password: z.string().min(6).openapi({
      example: 'password123',
      description: '密码，至少6个字符',
    }),
    confirmPassword: z.string().min(6).openapi({
      example: 'password123',
      description: '确认密码',
    }),
  })
  .openapi('RegisterRequest');

/**
 * 认证响应 Schema
 */
const AuthResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    data: z.object({
      user: UserSchema,
      tokens: z.object({
        accessToken: z.string().openapi({
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'JWT 访问令牌，15分钟有效期',
        }),
        refreshToken: z.string().openapi({
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: '刷新令牌，7天有效期',
        }),
        expiresIn: z.number().openapi({
          example: 900,
          description: '访问令牌过期时间（秒）',
        }),
      }),
    }),
    message: z.string().openapi({ example: '登录成功' }),
    requestId: z.string().openapi({ example: 'uuid-request-id' }),
  })
  .openapi('AuthResponse');

/**
 * 刷新令牌请求 Schema
 */
const RefreshTokenRequestSchema = z
  .object({
    refreshToken: z.string().openapi({
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: '有效的刷新令牌',
    }),
  })
  .openapi('RefreshTokenRequest');

/**
 * 登录路由
 */
export const loginRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Authentication'],
  summary: '用户登录',
  description: '使用用户名/邮箱和密码进行登录认证',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginRequestSchema,
        },
      },
      description: '登录凭据',
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
      description: '登录成功',
    },
    400: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '请求参数错误',
    },
    401: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '认证失败',
    },
    429: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '请求过于频繁',
    },
  },
});

/**
 * 注册路由
 */
export const registerRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/register',
  tags: ['Authentication'],
  summary: '用户注册',
  description: '创建新的用户账户',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RegisterRequestSchema,
        },
      },
      description: '注册信息',
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
      description: '注册成功',
    },
    400: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '请求参数错误',
    },
    409: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '用户名或邮箱已存在',
    },
    429: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '请求过于频繁',
    },
  },
});

/**
 * 刷新令牌路由
 */
export const refreshTokenRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Authentication'],
  summary: '刷新访问令牌',
  description: '使用刷新令牌获取新的访问令牌',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RefreshTokenRequestSchema,
        },
      },
      description: '刷新令牌',
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
      description: '令牌刷新成功',
    },
    401: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '刷新令牌无效或已过期',
    },
  },
});

/**
 * 登出路由
 */
export const logoutRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Authentication'],
  summary: '用户登出',
  description: '注销当前用户会话，使令牌失效',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Success,
        },
      },
      description: '登出成功',
    },
    401: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '未认证或令牌无效',
    },
  },
});

/**
 * 获取当前用户信息路由
 */
export const getCurrentUserRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['Authentication'],
  summary: '获取当前用户信息',
  description: '获取当前认证用户的详细信息',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.object({
              user: UserSchema,
            }),
            requestId: z.string().openapi({ example: 'uuid-request-id' }),
          }),
        },
      },
      description: '用户信息获取成功',
    },
    401: {
      content: {
        'application/json': {
          schema: CommonResponseSchemas.Error,
        },
      },
      description: '未认证或令牌无效',
    },
  },
});
