import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyAccessToken } from '../utils/jwt';
import type { UserContext } from '@neolink/shared';

/**
 * 认证中间件选项
 */
export interface AuthMiddlewareOptions {
  optional?: boolean;
  roles?: string[];
  message?: string;
  errorMessage?: string;
}

/**
 * 认证中间件
 */
export function authMiddleware(options: AuthMiddlewareOptions = {}) {
  return async (c: Context, next: Next) => {
    const authorization = c.req.header('Authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      if (options.optional) {
        // 可选认证，继续处理请求
        await next();
        return;
      }

      throw new HTTPException(401, {
        message:
          options.errorMessage ||
          options.message ||
          'Missing or invalid authorization header',
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

      // 检查角色权限
      if (options.roles && options.roles.length > 0) {
        if (!options.roles.includes(user.role) && user.role !== 'admin') {
          throw new HTTPException(403, {
            message: `Access denied. Required roles: ${options.roles.join(', ')}`,
          });
        }
      }

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      if (options.optional) {
        // 可选认证，忽略认证错误
        console.warn('Optional auth failed:', error);
        await next();
        return;
      }

      console.error('Token verification failed:', error);
      throw new HTTPException(401, {
        message:
          options.errorMessage || options.message || 'Invalid or expired token',
      });
    }
  };
}

/**
 * 必需认证中间件（别名）
 */
export const requireAuth = authMiddleware();

/**
 * 可选认证中间件（不强制要求认证）
 */
export const optionalAuth = authMiddleware({ optional: true });

/**
 * 获取当前用户
 */
export function getCurrentUser(c: Context): UserContext | null {
  return (c.get('user') as UserContext | null) || null;
}

/**
 * 检查权限
 */
export function hasPermission(
  user: UserContext | undefined,
  resource: string,
  action: string
): boolean {
  if (!user || !user.isActive) return false;

  // 管理员拥有所有权限
  if ((user.role as string) === 'admin') return true;

  // 基于资源和操作的权限检查
  switch (resource) {
    case 'bookmarks':
      switch (action) {
        case 'create':
        case 'read':
          return ['user', 'moderator', 'admin'].includes(user.role);
        case 'update':
        case 'delete':
          return ['moderator', 'admin'].includes(user.role);
        default:
          return false;
      }
    case 'system':
      switch (action) {
        case 'manage':
          return (user.role as string) === 'admin';
        default:
          return false;
      }
    default:
      return false;
  }
}

/**
 * 要求管理员权限（包含认证）
 */
export const requireAdmin = async (c: Context, next: Next) => {
  // 先进行认证
  await authMiddleware()(c, async () => {
    // 认证成功后检查权限
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
  });
};

/**
 * 要求版主权限（包含认证）
 */
export const requireModerator = async (c: Context, next: Next) => {
  // 先进行认证
  await authMiddleware()(c, async () => {
    // 认证成功后检查权限
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
  });
};

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
