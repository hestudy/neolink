import { eq, and, desc, asc, count, like, or } from 'drizzle-orm';
import { db } from '@neolink/database/connection';
import { bookmarks } from '@neolink/database/schema';
import {
  CreateBookmarkSchema,
  UpdateBookmarkSchema,
  ListBookmarksSchema,
} from '@neolink/shared/schemas';
import { z } from 'zod';
import { ContentExtractionAdapter } from '@neolink/ai/services/ContentExtractionAdapter';
import { queueManager, JobType } from './taskQueue';
import { processingJobRepository } from '../repositories/ProcessingJobRepository';
import { Redis } from 'ioredis';

/**
 * 书签数据接口
 */
export interface BookmarkData {
  id: string;
  url: string;
  title?: string;
  description?: string;
  content?: string;
  summary?: string;
  favicon?: string;
  screenshot?: string;
  tags: string[];
  aiTags: string[];
  manualTags: string[];
  notes?: string;
  isArchived: boolean;
  isDeleted: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

/**
 * 网页内容提取结果接口
 */
export interface WebContentExtraction {
  title?: string;
  description?: string;
  content?: string;
  favicon?: string;
  screenshot?: string;
  domain?: string;
  language?: string;
  wordCount?: number;
  readingTime?: number;
}

/**
 * 书签服务配置
 */
interface BookmarkServiceConfig {
  redis?: Redis;
  enableAsyncExtraction?: boolean;
}

/**
 * 内容提取器包装类
 * 使用新的基于Puppeteer的内容提取服务
 */
class WebContentExtractor {
  private contentAdapter: ContentExtractionAdapter;

  constructor(_redis?: Redis) {
    this.contentAdapter = new ContentExtractionAdapter({
      timeout: 30000,
      enableCache: true,
      cacheTtl: 7 * 24 * 3600, // 7天缓存
      enableScreenshots: false, // 默认关闭截图以提高性能
      enableFullContent: true,
    });
  }

  /**
   * 提取网页内容（使用新的Puppeteer内容提取服务）
   */
  async extractContent(url: string): Promise<WebContentExtraction> {
    return this.contentAdapter.extractContent(url);
  }

  /**
   * 检查服务是否就绪
   */
  async isReady(): Promise<boolean> {
    return this.contentAdapter.isReady();
  }

  /**
   * 关闭并清理资源
   */
  async close(): Promise<void> {
    await this.contentAdapter.close();
  }
}

/**
 * 书签服务类
 */
export class BookmarkService {
  private contentExtractor: WebContentExtractor;
  private config: BookmarkServiceConfig;

  constructor(config: BookmarkServiceConfig = {}) {
    this.config = config;
    this.contentExtractor = new WebContentExtractor(config.redis);
  }

  /**
   * 创建书签
   */
  async create(
    userId: string,
    bookmarkData: z.infer<typeof CreateBookmarkSchema>
  ): Promise<BookmarkData> {
    // 验证输入数据
    const validatedData = CreateBookmarkSchema.parse(bookmarkData);

    // 检查 URL 是否已存在（去重逻辑）
    const existingBookmark = await this.findByUrl(userId, validatedData.url);
    if (existingBookmark && !existingBookmark.isDeleted) {
      throw new Error('该 URL 已经存在于您的书签中');
    }

    let extractedContent: WebContentExtraction = {};
    let processingStatus: 'pending' | 'processing' | 'completed' | 'failed' =
      'pending';

    // 根据配置决定是否异步提取内容
    if (this.config.enableAsyncExtraction && this.config.redis) {
      // 异步模式：先创建书签，然后排队提取内容
      processingStatus = 'pending';
    } else {
      // 同步模式：立即提取内容（向后兼容）
      try {
        extractedContent = await this.contentExtractor.extractContent(
          validatedData.url
        );
        processingStatus = 'completed';
      } catch (error) {
        console.warn(
          'Content extraction failed, creating bookmark without content:',
          error
        );
        processingStatus = 'failed';
      }
    }

    // 准备插入数据（只使用数据库中实际存在的字段）
    const insertData = {
      url: validatedData.url,
      title:
        validatedData.title ||
        extractedContent.title ||
        new URL(validatedData.url).hostname ||
        'Untitled',
      description: validatedData.description || extractedContent.description,
      content: extractedContent.content,
      favicon: extractedContent.favicon,
      tags: validatedData.tags || [],
      aiTags: [],
      manualTags: validatedData.tags || [],
      isArchived: false,
      isDeleted: false,
      processingStatus,
      userId,
    };

    // 插入数据库
    const [newBookmark] = await db
      .insert(bookmarks)
      .values(insertData)
      .returning();

    // 如果启用异步提取，添加到队列
    if (this.config.enableAsyncExtraction) {
      try {
        // 创建处理任务记录
        await processingJobRepository.create({
          bookmarkId: newBookmark.id,
          type: JobType.CONTENT_EXTRACTION,
          status: 'pending',
          priority: 1,
          attempts: 0,
          maxAttempts: 3,
        });

        // 添加到任务队列
        await queueManager.addContentExtractionJob(
          newBookmark.id,
          validatedData.url,
          userId,
          {
            priority: 1,
            enableScreenshots: true,
            enableFullContent: true,
          }
        );

        console.log(
          `📋 Content extraction job created for bookmark ${newBookmark.id}`
        );
      } catch (error) {
        console.error('Failed to add content extraction job to queue:', error);
        // 更新书签状态为失败
        await db
          .update(bookmarks)
          .set({ processingStatus: 'failed' })
          .where(eq(bookmarks.id, newBookmark.id));
      }
    }

    return this.toBookmarkData(newBookmark);
  }

  /**
   * 根据 URL 查找书签
   */
  async findByUrl(userId: string, url: string): Promise<BookmarkData | null> {
    const [bookmark] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, url)))
      .limit(1);

    return bookmark ? this.toBookmarkData(bookmark) : null;
  }

  /**
   * 根据 ID 获取书签
   */
  async findById(userId: string, id: string): Promise<BookmarkData | null> {
    const [bookmark] = await db
      .select()
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.id, id),
          eq(bookmarks.userId, userId),
          eq(bookmarks.isDeleted, false)
        )
      )
      .limit(1);

    return bookmark ? this.toBookmarkData(bookmark) : null;
  }

  /**
   * 获取书签列表
   */
  async list(
    userId: string,
    params: z.infer<typeof ListBookmarksSchema>
  ): Promise<{
    bookmarks: BookmarkData[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const validatedParams = ListBookmarksSchema.parse(params);
    const { page, limit, search, isArchived, sortBy, sortOrder } =
      validatedParams;

    // 构建查询条件
    const conditions = [
      eq(bookmarks.userId, userId),
      eq(bookmarks.isDeleted, false),
    ];

    if (isArchived !== undefined) {
      conditions.push(eq(bookmarks.isArchived, isArchived));
    }

    if (search) {
      conditions.push(
        or(
          like(bookmarks.title, `%${search}%`),
          like(bookmarks.description, `%${search}%`),
          like(bookmarks.url, `%${search}%`)
        )!
      );
    }

    // TODO: 实现标签筛选
    // if (tags && tags.length > 0) {
    //   // 需要实现 JSON 数组查询
    // }

    const whereClause = and(...conditions);

    // 获取总数
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(bookmarks)
      .where(whereClause);

    // 构建排序
    let orderBy;
    switch (sortBy) {
      case 'createdAt':
        orderBy =
          sortOrder === 'asc'
            ? asc(bookmarks.createdAt)
            : desc(bookmarks.createdAt);
        break;
      case 'updatedAt':
        orderBy =
          sortOrder === 'asc'
            ? asc(bookmarks.updatedAt)
            : desc(bookmarks.updatedAt);
        break;
      case 'title':
        orderBy =
          sortOrder === 'asc' ? asc(bookmarks.title) : desc(bookmarks.title);
        break;
      case 'lastAccessedAt':
      default:
        orderBy =
          sortOrder === 'asc'
            ? asc(bookmarks.updatedAt)
            : desc(bookmarks.updatedAt);
        break;
    }

    // 获取分页数据
    const bookmarkList = await db
      .select()
      .from(bookmarks)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      bookmarks: bookmarkList.map((bookmark) => this.toBookmarkData(bookmark)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 更新书签
   */
  async update(
    userId: string,
    id: string,
    updateData: z.infer<typeof UpdateBookmarkSchema>
  ): Promise<BookmarkData | null> {
    const validatedData = UpdateBookmarkSchema.parse(updateData);

    // 检查书签是否存在且属于用户
    const existingBookmark = await this.findById(userId, id);
    if (!existingBookmark) {
      return null;
    }

    // 更新数据
    const [updatedBookmark] = await db
      .update(bookmarks)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookmarks.id, id),
          eq(bookmarks.userId, userId),
          eq(bookmarks.isDeleted, false)
        )
      )
      .returning();

    return updatedBookmark ? this.toBookmarkData(updatedBookmark) : null;
  }

  /**
   * 删除书签（软删除）
   */
  async delete(userId: string, id: string): Promise<boolean> {
    const result = await db
      .update(bookmarks)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookmarks.id, id),
          eq(bookmarks.userId, userId),
          eq(bookmarks.isDeleted, false)
        )
      );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 转换数据库记录为 BookmarkData
   */
  private toBookmarkData(
    bookmark: typeof bookmarks.$inferSelect
  ): BookmarkData {
    return {
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title || undefined,
      description: bookmark.description || undefined,
      content: bookmark.content || undefined,
      summary: bookmark.summary || undefined,
      favicon: bookmark.favicon || undefined,
      screenshot: bookmark.screenshot || undefined,
      tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
      aiTags: Array.isArray(bookmark.aiTags) ? bookmark.aiTags : [],
      manualTags: Array.isArray(bookmark.manualTags) ? bookmark.manualTags : [],
      notes: bookmark.notes || undefined,
      isArchived: bookmark.isArchived,
      isDeleted: bookmark.isDeleted,
      processingStatus: bookmark.processingStatus as
        | 'pending'
        | 'processing'
        | 'completed'
        | 'failed',
      embedding: bookmark.embedding,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
      userId: bookmark.userId,
    };
  }
}

// 导出单例实例（默认同步模式，向后兼容）
export const bookmarkService = new BookmarkService();

// 导出工厂函数用于创建配置的实例
export function createBookmarkService(
  config: BookmarkServiceConfig
): BookmarkService {
  return new BookmarkService(config);
}
