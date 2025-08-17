import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bookmarkService } from './bookmark';
import { db } from '@neolink/database/connection';
import { bookmarks, users } from '@neolink/database/schema';
import { eq } from 'drizzle-orm';

// Mock fetch for content extraction
global.fetch = vi.fn();

describe('BookmarkService', () => {
  let testUserId: string;
  let testBookmarkId: string;

  beforeEach(async () => {
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

    // Mock fetch response for content extraction
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'text/html; charset=utf-8';
          return null;
        },
      },
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
    if (testBookmarkId) {
      await db.delete(bookmarks).where(eq(bookmarks.id, testBookmarkId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a bookmark with extracted content', async () => {
      const bookmarkData = {
        url: 'https://example.com/test',
        title: 'Custom Title',
        description: 'Custom description',
      };

      const result = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = result.id;

      expect(result).toMatchObject({
        url: bookmarkData.url,
        title: bookmarkData.title,
        description: bookmarkData.description,
        userId: testUserId,
        isArchived: false,
        isDeleted: false,
        processingStatus: 'completed', // 同步模式下应该是completed
      });

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should use extracted title when no title provided', async () => {
      const bookmarkData = {
        url: 'https://example.com/test',
      };

      const result = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = result.id;

      expect(result.title).toBe('Test Page Title');
    });

    it('should prevent duplicate URLs', async () => {
      const bookmarkData = {
        url: 'https://example.com/duplicate',
        title: 'First Bookmark',
      };

      // 创建第一个书签
      const firstBookmark = await bookmarkService.create(
        testUserId,
        bookmarkData
      );
      testBookmarkId = firstBookmark.id;

      // 尝试创建重复的书签
      await expect(
        bookmarkService.create(testUserId, bookmarkData)
      ).rejects.toThrow('该 URL 已经存在于您的书签中');
    });

    it('should handle content extraction failure gracefully', async () => {
      // Mock fetch to fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const bookmarkData = {
        url: 'https://example.com/fail',
        title: 'Manual Title',
      };

      const result = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = result.id;

      expect(result.title).toBe('Manual Title');
      expect(result.url).toBe(bookmarkData.url);
    });
  });

  describe('findById', () => {
    it('should find bookmark by id', async () => {
      // 先创建一个书签
      const bookmarkData = {
        url: 'https://example.com/findtest',
        title: 'Find Test',
      };

      const created = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = created.id;

      // 查找书签
      const found = await bookmarkService.findById(testUserId, created.id);

      expect(found).toMatchObject({
        id: created.id,
        url: bookmarkData.url,
        title: bookmarkData.title,
        userId: testUserId,
      });
    });

    it('should return null for non-existent bookmark', async () => {
      const result = await bookmarkService.findById(
        testUserId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });

    it('should not find deleted bookmarks', async () => {
      // 创建并删除书签
      const bookmarkData = {
        url: 'https://example.com/deletetest',
        title: 'Delete Test',
      };

      const created = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = created.id;

      await bookmarkService.delete(testUserId, created.id);

      // 尝试查找已删除的书签
      const found = await bookmarkService.findById(testUserId, created.id);
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list bookmarks with pagination', async () => {
      // 创建多个书签
      const createdBookmarks = [];
      for (let i = 0; i < 3; i++) {
        const bookmark = await bookmarkService.create(testUserId, {
          url: `https://example.com/list${i}`,
          title: `List Test ${i}`,
        });
        createdBookmarks.push(bookmark);
      }

      const result = await bookmarkService.list(testUserId, {
        page: 1,
        limit: 2,
      });

      expect(result.bookmarks).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });

      // 清理
      for (const bookmark of createdBookmarks) {
        await db.delete(bookmarks).where(eq(bookmarks.id, bookmark.id));
      }
    });

    it('should filter by search term', async () => {
      // 创建测试书签
      const bookmark1 = await bookmarkService.create(testUserId, {
        url: 'https://example.com/react',
        title: 'React Documentation',
      });

      const bookmark2 = await bookmarkService.create(testUserId, {
        url: 'https://example.com/vue',
        title: 'Vue.js Guide',
      });

      const result = await bookmarkService.list(testUserId, {
        page: 1,
        limit: 10,
        search: 'React',
      });

      expect(result.bookmarks).toHaveLength(1);
      expect(result.bookmarks[0].title).toBe('React Documentation');

      // 清理
      await db.delete(bookmarks).where(eq(bookmarks.id, bookmark1.id));
      await db.delete(bookmarks).where(eq(bookmarks.id, bookmark2.id));
    });
  });

  describe('update', () => {
    it('should update bookmark', async () => {
      // 创建书签
      const bookmarkData = {
        url: 'https://example.com/update',
        title: 'Original Title',
      };

      const created = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = created.id;

      // 更新书签
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const updated = await bookmarkService.update(
        testUserId,
        created.id,
        updateData
      );

      expect(updated).toMatchObject({
        id: created.id,
        title: updateData.title,
        description: updateData.description,
        url: bookmarkData.url, // URL 不应该改变
      });
    });

    it('should return null for non-existent bookmark', async () => {
      const result = await bookmarkService.update(
        testUserId,
        '00000000-0000-0000-0000-000000000000',
        {
          title: 'New Title',
        }
      );

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should soft delete bookmark', async () => {
      // 创建书签
      const bookmarkData = {
        url: 'https://example.com/delete',
        title: 'Delete Test',
      };

      const created = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = created.id;

      // 删除书签
      const success = await bookmarkService.delete(testUserId, created.id);
      expect(success).toBe(true);

      // 验证书签不能再被找到
      const found = await bookmarkService.findById(testUserId, created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent bookmark', async () => {
      const success = await bookmarkService.delete(
        testUserId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(success).toBe(false);
    });
  });

  describe('findByUrl', () => {
    it('should find bookmark by URL', async () => {
      const bookmarkData = {
        url: 'https://example.com/findbyurl',
        title: 'Find by URL Test',
      };

      const created = await bookmarkService.create(testUserId, bookmarkData);
      testBookmarkId = created.id;

      const found = await bookmarkService.findByUrl(
        testUserId,
        bookmarkData.url
      );

      expect(found).toMatchObject({
        id: created.id,
        url: bookmarkData.url,
        title: bookmarkData.title,
      });
    });

    it('should return null for non-existent URL', async () => {
      const result = await bookmarkService.findByUrl(
        testUserId,
        'https://nonexistent.com'
      );
      expect(result).toBeNull();
    });
  });
});
