import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { UserContext } from '@neolink/shared';
import {
  authMiddleware,
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireModerator,
  getCurrentUser,
  hasPermission,
} from './auth';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';

describe('Auth Middleware', () => {
  let app: Hono;

  const mockUser: UserContext = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    isActive: true,
  };

  const mockAdmin: UserContext = {
    id: 'admin-123',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
  };

  const mockModerator: UserContext = {
    id: 'mod-123',
    username: 'moderator',
    email: 'mod@example.com',
    role: 'moderator',
    isActive: true,
  };

  beforeEach(() => {
    app = new Hono();

    // 设置测试环境变量
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.JWT_AUDIENCE = 'test-audience';
  });

  describe('authMiddleware', () => {
    it('should allow request with valid access token', async () => {
      const token = generateAccessToken(mockUser);

      app.get('/test', authMiddleware(), (c) => {
        const user = getCurrentUser(c);
        return c.json({ user });
      });

      const res = await app.request('/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe(mockUser.id);
      expect(data.user.username).toBe(mockUser.username);
    });

    it('should reject request without token', async () => {
      app.get('/test', authMiddleware(), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(401);
    });

    it('should allow request without token when optional', async () => {
      app.get('/test', authMiddleware({ optional: true }), (c) => {
        const user = getCurrentUser(c);
        return c.json({ user });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user).toBeNull();
    });

    it('should reject request with invalid token', async () => {
      app.get('/test', authMiddleware(), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(res.status).toBe(401);
    });

    it('should reject refresh token as access token', async () => {
      const refreshToken = generateRefreshToken(mockUser);

      app.get('/test', authMiddleware(), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test', {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      expect(res.status).toBe(401);
    });

    it('should check role permissions', async () => {
      const token = generateAccessToken(mockUser);

      app.get('/admin', authMiddleware({ roles: ['admin'] }), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/admin', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(403); // 普通用户访问管理员路由
    });

    it('should allow admin access to admin routes', async () => {
      const token = generateAccessToken(mockAdmin);

      app.get('/admin', authMiddleware({ roles: ['admin'] }), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/admin', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });

    it('should allow moderator access to moderator routes', async () => {
      const token = generateAccessToken(mockModerator);

      app.get(
        '/mod',
        authMiddleware({ roles: ['admin', 'moderator'] }),
        (c) => {
          return c.json({ success: true });
        }
      );

      const res = await app.request('/mod', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });

    it('should use custom error message', async () => {
      const customMessage = 'Custom error message';

      app.get('/test', authMiddleware({ errorMessage: customMessage }), (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/test');
      expect(res.status).toBe(401);

      // HTTPException 可能返回纯文本而不是JSON
      const text = await res.text();
      expect(text).toContain(customMessage);
    });
  });

  describe('requireAuth', () => {
    it('should require valid authentication', async () => {
      app.get('/protected', requireAuth, (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/protected');
      expect(res.status).toBe(401);
    });

    it('should allow authenticated requests', async () => {
      const token = generateAccessToken(mockUser);

      app.get('/protected', requireAuth, (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/protected', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('optionalAuth', () => {
    it('should allow unauthenticated requests', async () => {
      app.get('/optional', optionalAuth, (c) => {
        const user = getCurrentUser(c);
        return c.json({ authenticated: !!user });
      });

      const res = await app.request('/optional');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authenticated).toBe(false);
    });

    it('should process authenticated requests', async () => {
      const token = generateAccessToken(mockUser);

      app.get('/optional', optionalAuth, (c) => {
        const user = getCurrentUser(c);
        return c.json({ authenticated: !!user, userId: user?.id });
      });

      const res = await app.request('/optional', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.userId).toBe(mockUser.id);
    });
  });

  describe('requireAdmin', () => {
    it('should reject non-admin users', async () => {
      const token = generateAccessToken(mockUser);

      app.get('/admin-only', requireAdmin, (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/admin-only', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(403);
    });

    it('should allow admin users', async () => {
      const token = generateAccessToken(mockAdmin);

      app.get('/admin-only', requireAdmin, (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/admin-only', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('requireModerator', () => {
    it('should reject regular users', async () => {
      const token = generateAccessToken(mockUser);

      app.get('/mod-only', requireModerator, (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/mod-only', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(403);
    });

    it('should allow moderators', async () => {
      const token = generateAccessToken(mockModerator);

      app.get('/mod-only', requireModerator, (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/mod-only', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });

    it('should allow admins', async () => {
      const token = generateAccessToken(mockAdmin);

      app.get('/mod-only', requireModerator, (c) => {
        return c.json({ success: true });
      });

      const res = await app.request('/mod-only', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('hasPermission', () => {
    it('should grant all permissions to admin', () => {
      expect(hasPermission(mockAdmin, 'bookmarks', 'create')).toBe(true);
      expect(hasPermission(mockAdmin, 'system', 'manage')).toBe(true);
    });

    it('should grant limited permissions to moderator', () => {
      expect(hasPermission(mockModerator, 'bookmarks', 'read')).toBe(true);
      expect(hasPermission(mockModerator, 'bookmarks', 'update')).toBe(true);
      expect(hasPermission(mockModerator, 'system', 'manage')).toBe(false);
    });

    it('should grant basic permissions to user', () => {
      expect(hasPermission(mockUser, 'bookmarks', 'create')).toBe(true);
      expect(hasPermission(mockUser, 'bookmarks', 'read')).toBe(true);
      expect(hasPermission(mockUser, 'system', 'manage')).toBe(false);
    });
  });
});
