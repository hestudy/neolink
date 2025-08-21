/**
 * 摘要管理相关 API 路由
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@neolink/database/connection';
import { bookmarks } from '@neolink/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { queueManager } from '../services/taskQueue';
import { authMiddleware, getCurrentUser } from '../middleware/auth';

const app = new Hono();

// 生成摘要请求 schema
const GenerateSummarySchema = z.object({
  summaryLength: z.enum(['short', 'medium', 'long']).optional(),
  provider: z.enum(['openai', 'claude']).optional(),
  force: z.boolean().optional(), // 强制重新生成
});

// 摘要历史 schema (预留用于将来的历史功能)
const _SummaryHistorySchema = z.object({
  limit: z.number().min(1).max(50).optional(),
  offset: z.number().min(0).optional(),
});

/**
 * 为书签生成摘要
 * POST /api/bookmarks/:bookmarkId/summary/generate
 */
app.post(
  '/:bookmarkId/generate',
  authMiddleware(),
  zValidator('param', z.object({ bookmarkId: z.string().uuid() })),
  zValidator('json', GenerateSummarySchema),
  async (c) => {
    try {
      const { bookmarkId } = c.req.valid('param');
      const { summaryLength, provider, force } = c.req.valid('json');

      // 从认证中间件获取用户 ID
      const user = getCurrentUser(c);
      if (!user) {
        return c.json({ error: 'User not authenticated' }, 401);
      }
      const userId = user.id;

      // 检查书签是否存在
      const bookmark = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, bookmarkId),
            eq(bookmarks.userId, userId),
            isNull(bookmarks.isDeleted)
          )
        )
        .limit(1);

      if (!bookmark.length) {
        return c.json({ error: 'Bookmark not found' }, 404);
      }

      const bookmarkData = bookmark[0];

      // 检查是否已有摘要且不强制重新生成
      if (!force && bookmarkData.summary) {
        return c.json(
          {
            message: 'Summary already exists. Use force=true to regenerate.',
            existing: {
              summary: bookmarkData.summary,
              metadata: bookmarkData.summaryMetadata,
            },
          },
          200
        );
      }

      // 检查是否有内容可以摘要
      if (!bookmarkData.content || bookmarkData.content.trim().length < 100) {
        return c.json(
          {
            error:
              'Insufficient content for summary generation. Content must be at least 100 characters.',
          },
          400
        );
      }

      // 添加到摘要生成队列
      const job = await queueManager.addSummaryGenerationJob(
        bookmarkId,
        bookmarkData.content,
        'en', // TODO: 从内容检测语言
        userId,
        {
          title: bookmarkData.title || undefined,
          description: bookmarkData.description || undefined,
        },
        {
          summaryLength: summaryLength || 'medium',
          provider,
          priority: force ? 10 : 5, // 强制重新生成的优先级更高
        }
      );

      return c.json(
        {
          message: 'Summary generation job queued successfully',
          jobId: job.id,
          status: 'queued',
          estimated: {
            processingTime: '10-30 seconds',
            position: 0, // BullMQ job position 功能待实现
          },
        },
        202
      );
    } catch (error) {
      console.error('Error generating summary:', error);
      return c.json(
        {
          error: 'Failed to queue summary generation',
          details: (error as Error).message,
        },
        500
      );
    }
  }
);

/**
 * 获取摘要生成状态
 * GET /api/bookmarks/:bookmarkId/summary/status/:jobId
 */
app.get(
  '/:bookmarkId/status/:jobId',
  authMiddleware(),
  zValidator(
    'param',
    z.object({
      bookmarkId: z.string().uuid(),
      jobId: z.string(),
    })
  ),
  async (c) => {
    try {
      const { jobId } = c.req.valid('param');

      // 获取任务状态
      const jobStatus = await queueManager.getJobStatus('ai-summary', jobId);
      const job = await queueManager.getJob('ai-summary', jobId);

      if (!job) {
        return c.json({ error: 'Job not found' }, 404);
      }

      const response: {
        jobId: string;
        status: string;
        progress: number;
        result?: unknown;
        error?: string;
      } = {
        jobId,
        status: jobStatus || 'unknown',
        progress: (job.progress as number) || 0,
      };

      // 如果任务完成，获取最新的摘要数据
      if (jobStatus === 'completed') {
        const { bookmarkId } = c.req.valid('param');
        const bookmark = await db
          .select({
            summary: bookmarks.summary,
            summaryMetadata: bookmarks.summaryMetadata,
          })
          .from(bookmarks)
          .where(eq(bookmarks.id, bookmarkId))
          .limit(1);

        if (bookmark.length) {
          response.result = {
            summary: bookmark[0].summary,
            metadata: bookmark[0].summaryMetadata,
          };
        }
      } else if (jobStatus === 'failed') {
        response.error = job.failedReason || 'Summary generation failed';
      }

      return c.json(response);
    } catch (error) {
      console.error('Error getting summary status:', error);
      return c.json(
        {
          error: 'Failed to get summary status',
          details: (error as Error).message,
        },
        500
      );
    }
  }
);

/**
 * 获取书签的当前摘要
 * GET /api/bookmarks/:bookmarkId/summary
 */
app.get(
  '/:bookmarkId',
  authMiddleware(),
  zValidator('param', z.object({ bookmarkId: z.string().uuid() })),
  async (c) => {
    try {
      const { bookmarkId } = c.req.valid('param');

      // 从认证中间件获取用户 ID
      const user = getCurrentUser(c);
      if (!user) {
        return c.json({ error: 'User not authenticated' }, 401);
      }
      const userId = user.id;

      const bookmark = await db
        .select({
          summary: bookmarks.summary,
          summaryMetadata: bookmarks.summaryMetadata,
          title: bookmarks.title,
          url: bookmarks.url,
          updatedAt: bookmarks.updatedAt,
        })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, bookmarkId),
            eq(bookmarks.userId, userId),
            isNull(bookmarks.isDeleted)
          )
        )
        .limit(1);

      if (!bookmark.length) {
        return c.json({ error: 'Bookmark not found' }, 404);
      }

      const bookmarkData = bookmark[0];

      if (!bookmarkData.summary) {
        return c.json(
          {
            message: 'No summary available',
            bookmark: {
              id: bookmarkId,
              title: bookmarkData.title,
              url: bookmarkData.url,
            },
            actions: {
              generate: `/api/bookmarks/${bookmarkId}/summary/generate`,
            },
          },
          404
        );
      }

      return c.json({
        summary: bookmarkData.summary,
        metadata: bookmarkData.summaryMetadata,
        bookmark: {
          id: bookmarkId,
          title: bookmarkData.title,
          url: bookmarkData.url,
          updatedAt: bookmarkData.updatedAt,
        },
        actions: {
          regenerate: `/api/bookmarks/${bookmarkId}/summary/generate`,
        },
      });
    } catch (error) {
      console.error('Error getting summary:', error);
      return c.json(
        {
          error: 'Failed to get summary',
          details: (error as Error).message,
        },
        500
      );
    }
  }
);

/**
 * 删除书签摘要
 * DELETE /api/bookmarks/:bookmarkId/summary
 */
app.delete(
  '/:bookmarkId',
  authMiddleware(),
  zValidator('param', z.object({ bookmarkId: z.string().uuid() })),
  async (c) => {
    try {
      const { bookmarkId } = c.req.valid('param');

      // 从认证中间件获取用户 ID
      const user = getCurrentUser(c);
      if (!user) {
        return c.json({ error: 'User not authenticated' }, 401);
      }
      const userId = user.id;

      // 检查书签是否存在
      const bookmark = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.id, bookmarkId),
            eq(bookmarks.userId, userId),
            isNull(bookmarks.isDeleted)
          )
        )
        .limit(1);

      if (!bookmark.length) {
        return c.json({ error: 'Bookmark not found' }, 404);
      }

      // 删除摘要数据
      await db
        .update(bookmarks)
        .set({
          summary: null,
          summaryMetadata: null,
          updatedAt: new Date(),
        })
        .where(eq(bookmarks.id, bookmarkId));

      return c.json({
        message: 'Summary deleted successfully',
        bookmarkId,
      });
    } catch (error) {
      console.error('Error deleting summary:', error);
      return c.json(
        {
          error: 'Failed to delete summary',
          details: (error as Error).message,
        },
        500
      );
    }
  }
);

/**
 * 批量生成摘要
 * POST /api/bookmarks/summary/batch-generate
 */
app.post(
  '/batch-generate',
  authMiddleware(),
  zValidator(
    'json',
    z.object({
      bookmarkIds: z.array(z.string().uuid()).min(1).max(50),
      summaryLength: z.enum(['short', 'medium', 'long']).optional(),
      provider: z.enum(['openai', 'claude']).optional(),
      force: z.boolean().optional(),
    })
  ),
  async (c) => {
    try {
      const { bookmarkIds, summaryLength, provider, force } =
        c.req.valid('json');

      // 从认证中间件获取用户 ID
      const user = getCurrentUser(c);
      if (!user) {
        return c.json({ error: 'User not authenticated' }, 401);
      }
      const userId = user.id;

      // 获取用户的书签
      const userBookmarks = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          description: bookmarks.description,
          content: bookmarks.content,
          summary: bookmarks.summary,
        })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.isDeleted)));

      const validBookmarks = userBookmarks.filter(
        (b) =>
          bookmarkIds.includes(b.id) &&
          b.content &&
          b.content.trim().length >= 100 &&
          (force || !b.summary)
      );

      if (validBookmarks.length === 0) {
        return c.json(
          {
            message: 'No valid bookmarks found for summary generation',
            checked: bookmarkIds.length,
            valid: 0,
          },
          400
        );
      }

      // 批量添加到队列
      const jobs = await Promise.all(
        validBookmarks.map(async (bookmark) => {
          const job = await queueManager.addSummaryGenerationJob(
            bookmark.id,
            bookmark.content!,
            'en', // TODO: 检测语言
            userId,
            {
              title: bookmark.title || undefined,
              description: bookmark.description || undefined,
            },
            {
              summaryLength: summaryLength || 'medium',
              provider,
              priority: 5,
            }
          );

          return {
            bookmarkId: bookmark.id,
            jobId: job.id,
            title: bookmark.title,
          };
        })
      );

      return c.json(
        {
          message: `${jobs.length} summary generation jobs queued successfully`,
          jobs,
          estimated: {
            totalProcessingTime: `${jobs.length * 15}-${jobs.length * 30} seconds`,
            batchSize: jobs.length,
          },
        },
        202
      );
    } catch (error) {
      console.error('Error in batch summary generation:', error);
      return c.json(
        {
          error: 'Failed to queue batch summary generation',
          details: (error as Error).message,
        },
        500
      );
    }
  }
);

export default app;
