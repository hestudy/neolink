import { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { OpenAPIHono } from '@hono/zod-openapi';

/**
 * 自定义错误类
 */
export class TooManyRequestsError extends Error {
  constructor(message: string = 'Too many requests') {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * 错误处理中间件
 */
export function setupErrorHandlers(app: Hono | OpenAPIHono) {
  // 404 处理器
  (app as Hono).notFound((c: Context) => {
    const requestId = c.get('requestId') || 'unknown';

    return c.json(
      {
        success: false,
        error: 'Not Found',
        message: 'The requested resource was not found',
        timestamp: new Date().toISOString(),
        requestId,
      },
      404
    );
  });

  (app as Hono).onError((err: Error, c: Context) => {
    const requestId = c.get('requestId') || 'unknown';

    console.error('Error:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      requestId,
      path: c.req.path,
      method: c.req.method,
    });

    // HTTP 异常
    if (err instanceof HTTPException) {
      return c.json(
        {
          success: false,
          error: err.message,
          message: err.message,
          timestamp: new Date().toISOString(),
          requestId,
        },
        err.status
      );
    }

    // 自定义错误
    if (err instanceof TooManyRequestsError) {
      return c.json(
        {
          success: false,
          error: 'Too Many Requests',
          message: err.message,
          timestamp: new Date().toISOString(),
          requestId,
        },
        429
      );
    }

    if (err instanceof ValidationError) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          message: err.message,
          timestamp: new Date().toISOString(),
          requestId,
          details: err.details,
        },
        400
      );
    }

    if (err instanceof AuthenticationError) {
      return c.json(
        {
          success: false,
          error: 'Authentication Error',
          message: err.message,
          timestamp: new Date().toISOString(),
          requestId,
        },
        401
      );
    }

    if (err instanceof AuthorizationError) {
      return c.json(
        {
          success: false,
          error: 'Authorization Error',
          message: err.message,
          timestamp: new Date().toISOString(),
          requestId,
        },
        403
      );
    }

    if (err instanceof NotFoundError) {
      return c.json(
        {
          success: false,
          error: 'Not Found',
          message: err.message,
          timestamp: new Date().toISOString(),
          requestId,
        },
        404
      );
    }

    // 默认服务器错误
    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message,
        timestamp: new Date().toISOString(),
        requestId,
      },
      500
    );
  });
}
