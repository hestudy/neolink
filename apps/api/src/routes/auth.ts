import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { rateLimiters } from '../middleware/rateLimit';

export const authRoute = new Hono();

// 为认证相关操作应用严格的速率限制
authRoute.use('/login', rateLimiters.auth);
authRoute.use('/register', rateLimiters.auth);

// 登录端点
authRoute.post('/login', async (c) => {
  // TODO: 实现登录逻辑
  return c.json({
    message: 'Login endpoint - to be implemented',
    success: false,
  });
});

// 注册端点
authRoute.post('/register', async (c) => {
  // TODO: 实现注册逻辑
  return c.json({
    message: 'Register endpoint - to be implemented',
    success: false,
  });
});

// 刷新令牌端点
authRoute.post('/refresh', async (c) => {
  // TODO: 实现刷新令牌逻辑
  return c.json({
    message: 'Refresh token endpoint - to be implemented',
    success: false,
  });
});

// 登出端点（需要认证）
authRoute.post(
  '/logout',
  rateLimiters.authenticated,
  authMiddleware(),
  async (c) => {
    // TODO: 实现登出逻辑
    return c.json({
      message: 'Logout endpoint - to be implemented',
      success: false,
    });
  }
);

// 获取当前用户信息（需要认证）
authRoute.get(
  '/me',
  rateLimiters.authenticated,
  authMiddleware(),
  async (c) => {
    const user = c.get('user');
    return c.json({
      user,
      success: true,
    });
  }
);
