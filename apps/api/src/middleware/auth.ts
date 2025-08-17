import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyAccessToken } from '../utils/jwt';
import type { UserContext } from '@neolink/shared';

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

      // 构建用户上下文
      const user: UserContext = {
        id: payload.userId || 'unknown',
        username: payload.username || 'unknown',
        email: payload.email || 'unknown@example.com',
        role: payload.role || 'user',
        isActive: true,
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
 * 必需认证中间件（别名）
 */
export const requireAuth = authMiddleware;

/**
 * 可选认证中间件（不强制要求认证）
 */
export function optionalAuth() {
  return async (c: Context, next: Next) => {
    const authorization = c.req.header('Authorization');

    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.substring(7);

      try {
        const payload = verifyAccessToken(token);

        const user: UserContext = {
          id: payload.userId || 'unknown',
          username: payload.username || 'unknown',
          email: payload.email || 'unknown@example.com',
          role: payload.role || 'user',
          isActive: true,
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
 * 获取当前用户
 */
export function getCurrentUser(c: Context): UserContext | undefined {
  return c.get('user') as UserContext | undefined;
}

/**
 * 检查权限
 */
export function hasPermission(
  user: UserContext | undefined,
  permission: string
): boolean {
  if (!user || !user.isActive) return false;

  // 管理员拥有所有权限
  if (user.role === 'admin') return true;

  // 这里可以根据具体需求实现权限检查逻辑
  // 目前简单地基于角色进行检查
  switch (permission) {
    case 'read':
      return ['user', 'moderator', 'admin'].includes(user.role);
    case 'write':
      return ['moderator', 'admin'].includes(user.role);
    case 'admin':
      return user.role === 'admin';
    default:
      return false;
  }
}

/**
 * 要求管理员权限
 */
export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const user = getCurrentUser(c);

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }

    if (user.role !== 'admin') {
      throw new HTTPException(403, {
        message: 'Admin access required',
      });
    }

    await next();
  };
}

/**
 * 要求版主权限
 */
export function requireModerator() {
  return async (c: Context, next: Next) => {
    const user = getCurrentUser(c);

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required',
      });
    }

    if (!['moderator', 'admin'].includes(user.role)) {
      throw new HTTPException(403, {
        message: 'Moderator access required',
      });
    }

    await next();
  };
}

/**
 * 角色检查中间件
 */
export function requireRole(requiredRole: string) {
  return async (c: Context, next: Next) => {
    const user = getCurrentUser(c);

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
