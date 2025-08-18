import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { setupMiddleware } from '../middleware';
import { setupRoutes } from './index';
import { setupErrorHandlers } from '../middleware/errorHandler';
import { db } from '@neolink/database/connection';
import { bookmarks, users } from '@neolink/database/schema';
import { eq } from 'drizzle-orm';
import { generateTokenPair } from '../utils/jwt';

// Mock fetch for content extraction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.fetch = vi.fn() as unknown as typeof fetch;

describe.skip('Bookmarks Routes', () => {
  let app: Hono;
  let testUserId: string;
  let authToken: string;
  let testBookmarkIds: string[] = [];

  beforeEach(async () => {
    // 设置应用
    app = new Hono();
    setupMiddleware(app);
    setupRoutes(app);
    setupErrorHandlers(app);

    // 为每个测试生成唯一的邮箱
    const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;

    // 创建测试用户
    const [testUser] = await db
      .insert(users)
      .values({
        email: uniqueEmail,
        name: 'Test User',
      })
      .returning();
    testUserId = testUser.id;

    // 生成认证令牌
    const tokens = generateTokenPair({
      id: testUserId,
      username: 'testuser',
      email: testUser.email,
      role: 'user',
      isActive: true,
    });
    authToken = tokens.accessToken;

    // Mock fetch response for content extraction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(`
        <html>
          <head>
            <title>Test Page Title</title>
            <meta name="description" content="Test page description">
            <link rel="icon" href="/favicon.ico">
          </head>
          <body>
            <h1>Test Content</h1>
            <p>This is a test page with some content for testing.</p>
          </body>
        </html>
      `),
    });
  });

  afterEach(async () => {
    // 清理测试数据
    if (testBookmarkIds.length > 0) {
      for (const id of testBookmarkIds) {
        await db.delete(bookmarks).where(eq(bookmarks.id, id));
      }
      testBookmarkIds = [];
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    vi.clearAllMocks();
  });

  describe('POST /api/v1/bookmarks', () => {
    it('should create a bookmark successfully', async () => {
      const bookmarkData = {
        url: 'https://example.com/test',
        title: 'Test Bookmark',
        description: 'Test description',
      };

      const res = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(bookmarkData),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        url: bookmarkData.url,
        title: bookmarkData.title,
        description: bookmarkData.description,
        userId: testUserId,
      });

      testBookmarkIds.push(data.data.id);
    });

    it('should require authentication', async () => {
      const bookmarkData = {
        url: 'https://example.com/test',
        title: 'Test Bookmark',
      };

      const res = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookmarkData),
      });

      expect(res.status).toBe(401);
    });

    it('should validate input data', async () => {
      const invalidData = {
        url: 'invalid-url',
        title: '',
      };

      const res = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(invalidData),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation Error');
    });

    it('should prevent duplicate URLs', async () => {
      const bookmarkData = {
        url: 'https://example.com/duplicate',
        title: 'Duplicate Test',
      };

      // 创建第一个书签
      const res1 = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(bookmarkData),
      });

      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      testBookmarkIds.push(data1.data.id);

      // 尝试创建重复的书签
      const res2 = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(bookmarkData),
      });

      expect(res2.status).toBe(409);
      const data2 = await res2.json();
      expect(data2.success).toBe(false);
      expect(data2.error).toBe('Duplicate URL');
    });
  });

  describe('GET /api/v1/bookmarks', () => {
    it('should list bookmarks with pagination', async () => {
      // 创建测试书签
      const bookmarks = [];
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/api/v1/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            url: `https://example.com/list${i}`,
            title: `List Test ${i}`,
          }),
        });
        const data = await res.json();
        bookmarks.push(data.data);
        testBookmarkIds.push(data.data.id);
      }

      const res = await app.request('/api/v1/bookmarks?page=1&limit=2', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('should filter by search term', async () => {
      // 创建测试书签
      const res1 = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          url: 'https://example.com/react',
          title: 'React Documentation',
        }),
      });
      const data1 = await res1.json();
      testBookmarkIds.push(data1.data.id);

      const res2 = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          url: 'https://example.com/vue',
          title: 'Vue.js Guide',
        }),
      });
      const data2 = await res2.json();
      testBookmarkIds.push(data2.data.id);

      // 搜索 React
      const res = await app.request('/api/v1/bookmarks?search=React', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe('React Documentation');
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/v1/bookmarks', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/bookmarks/:id', () => {
    it('should get bookmark by id', async () => {
      // 创建书签
      const createRes = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          url: 'https://example.com/gettest',
          title: 'Get Test',
        }),
      });
      const createData = await createRes.json();
      testBookmarkIds.push(createData.data.id);

      // 获取书签
      const res = await app.request(`/api/v1/bookmarks/${createData.data.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        id: createData.data.id,
        url: 'https://example.com/gettest',
        title: 'Get Test',
      });
    });

    it('should return 404 for non-existent bookmark', async () => {
      const res = await app.request(
        '/api/v1/bookmarks/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Not Found');
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/v1/bookmarks/some-id', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/bookmarks/:id', () => {
    it('should update bookmark', async () => {
      // 创建书签
      const createRes = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          url: 'https://example.com/updatetest',
          title: 'Original Title',
        }),
      });
      const createData = await createRes.json();
      testBookmarkIds.push(createData.data.id);

      // 更新书签
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const res = await app.request(`/api/v1/bookmarks/${createData.data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        id: createData.data.id,
        title: updateData.title,
        description: updateData.description,
      });
    });

    it('should return 404 for non-existent bookmark', async () => {
      const res = await app.request(
        '/api/v1/bookmarks/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ title: 'New Title' }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/bookmarks/:id', () => {
    it('should delete bookmark', async () => {
      // 创建书签
      const createRes = await app.request('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          url: 'https://example.com/deletetest',
          title: 'Delete Test',
        }),
      });
      const createData = await createRes.json();
      const bookmarkId = createData.data.id;

      // 删除书签
      const res = await app.request(`/api/v1/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Origin: 'http://localhost:3000', // 添加 Origin 头部以通过 CSRF 检查
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // 验证书签已被删除
      const getRes = await app.request(`/api/v1/bookmarks/${bookmarkId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const res = await app.request(
        '/api/v1/bookmarks/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            Origin: 'http://localhost:3000', // 添加 Origin 头部以通过 CSRF 检查
          },
        }
      );

      expect(res.status).toBe(404);
    });
  });
});
