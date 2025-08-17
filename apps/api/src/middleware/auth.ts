import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyAccessToken } from '../utils/jwt';

/**
 * 用户类型定义
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

/**
 * 认证中间件
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const authorization = c.req.header('Authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new HTTPException(401, {
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authorization.substring(7); // Remove 'Bearer ' prefix

    try {
      const payload = verifyAccessToken(token);

      // TODO: 从数据库获取完整的用户信息
      const user: User = {
        id: payload.userId || 'unknown',
        email: payload.email || 'unknown@example.com',
        name: payload.username,
        role: payload.role || 'user',
      };

      // 设置用户信息到上下文
      c.set('user', user);

      await next();
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new HTTPException(401, {
        message: 'Invalid or expired token',
      });
    }
  };
}

/**
 * 可选认证中间件（不强制要求认证）
 */
export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const authorization = c.req.header('Authorization');

    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.substring(7);

      try {
        const payload = verifyAccessToken(token);

        const user: User = {
          id: payload.userId || 'unknown',
          email: payload.email || 'unknown@example.com',
          name: payload.username,
          role: payload.role || 'user',
        };

        c.set('user', user);
      } catch (error) {
        // 忽略认证错误，继续处理请求
        console.warn('Optional auth failed:', error);
      }
    }

    await next();
  };
}

/**
 * 角色检查中间件
 */
export function requireRole(requiredRole: string) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined;

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }

    if (user.role !== requiredRole && user.role !== 'admin') {
      throw new HTTPException(403, {
        message: `Access denied. Required role: ${requiredRole}`,
      });
    }

    await next();
  };
}
