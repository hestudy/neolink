import { OpenAPIHono } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { rateLimiters } from '../middleware/rateLimit';
import { authService } from '../services/authService';
import { tokenBlacklistService } from '../services/tokenBlacklistService';
import { verifyRefreshToken, extractTokenFromHeader } from '../utils/jwt';

export const authRoute = new OpenAPIHono();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z.string().min(8, '密码至少需要8个字符'),
  name: z.string().min(1, '姓名不能为空').optional(),
});

const LoginSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  password: z.string().min(1, '密码不能为空'),
  remember: z.boolean().optional(),
});

const ResetPasswordRequestSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, '重置令牌不能为空'),
  password: z.string().min(8, '密码至少需要8个字符'),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '刷新令牌不能为空'),
});

// 为认证相关操作应用严格的速率限制
authRoute.use('/login', rateLimiters.auth);
authRoute.use('/register', rateLimiters.auth);
authRoute.use('/forgot-password', rateLimiters.auth);
authRoute.use('/reset-password', rateLimiters.auth);
authRoute.use('/refresh', rateLimiters.auth);

// 为需要认证的端点应用认证用户的速率限制
authRoute.use('/me', rateLimiters.authenticated);

// 用户注册端点
authRoute.post('/register', zValidator('json', RegisterSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    // 验证密码强度
    const passwordValidation = authService.validatePassword(data.password);
    if (!passwordValidation.isValid) {
      return c.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: '密码强度不够',
          details: passwordValidation.errors,
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        400
      );
    }

    const result = await authService.register(data);

    return c.json(
      {
        success: true,
        data: {
          user: result.user,
          ...result.tokens,
        },
        message: '注册成功',
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') || 'unknown',
      },
      201
    );
  } catch (error) {
    console.error('Registration error:', error);

    const errorMessage = error instanceof Error ? error.message : '注册失败';

    return c.json(
      {
        success: false,
        error: 'REGISTRATION_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') || 'unknown',
      },
      400
    );
  }
});

// 用户登录端点
authRoute.post('/login', zValidator('json', LoginSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    const result = await authService.login(data);

    return c.json(
      {
        success: true,
        data: {
          user: result.user,
          ...result.tokens,
        },
        message: '登录成功',
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') || 'unknown',
      },
      200
    );
  } catch (error) {
    console.error('Login error:', error);

    const errorMessage = error instanceof Error ? error.message : '登录失败';

    return c.json(
      {
        success: false,
        error: 'LOGIN_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') || 'unknown',
      },
      401
    );
  }
});

// 刷新令牌端点
authRoute.post(
  '/refresh',
  zValidator('json', RefreshTokenSchema),
  async (c) => {
    try {
      const { refreshToken } = c.req.valid('json');

      // 验证刷新令牌
      const payload = verifyRefreshToken(refreshToken);

      // 获取用户信息
      const user = await authService.getUserById(payload.userId);
      if (!user) {
        return c.json(
          {
            success: false,
            error: 'USER_NOT_FOUND',
            message: '用户不存在',
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown',
          },
          401
        );
      }

      // 生成新的令牌对
      const { generateTokenPair } = await import('../utils/jwt');
      const tokens = generateTokenPair(user);

      return c.json(
        {
          success: true,
          data: {
            user,
            ...tokens,
          },
          message: '令牌刷新成功',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        200
      );
    } catch (error) {
      console.error('Token refresh error:', error);

      return c.json(
        {
          success: false,
          error: 'TOKEN_REFRESH_ERROR',
          message: '令牌刷新失败',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        401
      );
    }
  }
);

// 请求密码重置端点
authRoute.post(
  '/forgot-password',
  zValidator('json', ResetPasswordRequestSchema),
  async (c) => {
    try {
      const { email } = c.req.valid('json');

      await authService.requestPasswordReset(email);

      // 为安全起见，总是返回成功消息
      return c.json(
        {
          success: true,
          message: '如果该邮箱存在，重置链接已发送',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        200
      );
    } catch (error) {
      console.error('Password reset request error:', error);

      // 即使出错也不暴露详细信息
      return c.json(
        {
          success: true,
          message: '如果该邮箱存在，重置链接已发送',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        200
      );
    }
  }
);

// 重置密码端点
authRoute.post(
  '/reset-password',
  zValidator('json', ResetPasswordSchema),
  async (c) => {
    try {
      const data = c.req.valid('json');

      // 验证密码强度
      const passwordValidation = authService.validatePassword(data.password);
      if (!passwordValidation.isValid) {
        return c.json(
          {
            success: false,
            error: 'VALIDATION_ERROR',
            message: '密码强度不够',
            details: passwordValidation.errors,
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId') || 'unknown',
          },
          400
        );
      }

      await authService.resetPassword(data);

      return c.json(
        {
          success: true,
          message: '密码重置成功',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        200
      );
    } catch (error) {
      console.error('Password reset error:', error);

      const errorMessage =
        error instanceof Error ? error.message : '密码重置失败';

      return c.json(
        {
          success: false,
          error: 'PASSWORD_RESET_ERROR',
          message: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        400
      );
    }
  }
);

// 登出端点（需要认证）
authRoute.post(
  '/logout',
  rateLimiters.authenticated,
  authMiddleware(),
  async (c) => {
    try {
      // 获取当前token并将其添加到黑名单
      const authHeader = c.req.header('Authorization');
      const token = extractTokenFromHeader(authHeader);

      if (token) {
        // 将当前访问令牌添加到黑名单
        await tokenBlacklistService.blacklistToken(token);
        console.log('Token added to blacklist during logout');
      }

      return c.json(
        {
          success: true,
          message: '登出成功',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        200
      );
    } catch (error) {
      console.error('Logout error:', error);

      return c.json(
        {
          success: false,
          error: 'LOGOUT_ERROR',
          message: '登出失败',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') || 'unknown',
        },
        500
      );
    }
  }
);

// 获取当前用户信息（需要认证）
authRoute.get('/me', authMiddleware(), async (c) => {
  const user = c.get('user') as
    | { id: string; email: string; username: string; role: string }
    | undefined;

  if (!user) {
    return c.json(
      {
        success: false,
        error: 'UNAUTHORIZED',
        message: '未授权访问',
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') || 'unknown',
      },
      401
    );
  }

  return c.json(
    {
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      requestId: c.get('requestId') || 'unknown',
    },
    200
  );
});
