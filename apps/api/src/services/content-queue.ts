import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ContentExtractionAdapter } from '@neolink/ai/services/ContentExtractionAdapter';

/**
 * 网页内容提取结果接口（向后兼容）
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
import { db } from '@neolink/database/connection';
import { bookmarks } from '@neolink/database/schema';
import { eq } from 'drizzle-orm';

/**
 * 内容提取任务数据
 */
export interface ContentExtractionJobData {
  bookmarkId: string;
  url: string;
  userId: string;
  priority?: number;
}

/**
 * 内容提取结果
 */
export interface ContentExtractionResult {
  success: boolean;
  content?: WebContentExtraction;
  error?: string;
}

/**
 * 异步内容提取队列服务
 * 解决同步内容提取的性能问题
 */
export class ContentExtractionQueue {
  private queue: Queue<ContentExtractionJobData>;
  private worker: Worker<ContentExtractionJobData, ContentExtractionResult>;
  private contentExtractor: ContentExtractionAdapter;

  constructor(redis: Redis) {
    // 初始化内容提取服务
    this.contentExtractor = new ContentExtractionAdapter({
      timeout: 30000,
      enableCache: true,
      cacheTtl: 7 * 24 * 3600, // 7天缓存
      enableScreenshots: true, // 在后台任务中启用截图
      enableFullContent: true,
    });

    // 初始化队列
    this.queue = new Queue<ContentExtractionJobData>('content-extraction', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // 初始化工作器
    this.worker = new Worker<ContentExtractionJobData, ContentExtractionResult>(
      'content-extraction',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: 3,
        limiter: {
          max: 10,
          duration: 60000, // 每分钟最多处理10个任务
        },
      }
    );

    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 添加内容提取任务到队列
   */
  async addExtractionJob(
    data: ContentExtractionJobData
  ): Promise<Job<ContentExtractionJobData>> {
    return this.queue.add('extract-content', data, {
      priority: data.priority || 0,
      delay: 0,
    });
  }

  /**
   * 处理内容提取任务
   */
  private async processJob(
    job: Job<ContentExtractionJobData>
  ): Promise<ContentExtractionResult> {
    const { bookmarkId, url, userId } = job.data;

    try {
      console.log(
        `Processing content extraction for bookmark ${bookmarkId}, URL: ${url}`
      );

      // 提取内容
      const content = await this.contentExtractor.extractContent(url);

      // 更新数据库中的书签信息
      await this.updateBookmarkContent(bookmarkId, userId, content);

      console.log(`Content extraction completed for bookmark ${bookmarkId}`);

      return {
        success: true,
        content,
      };
    } catch (error) {
      console.error(
        `Content extraction failed for bookmark ${bookmarkId}:`,
        error
      );

      // 更新书签状态为失败
      await this.updateBookmarkStatus(bookmarkId, userId, 'failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 更新书签内容
   */
  private async updateBookmarkContent(
    bookmarkId: string,
    userId: string,
    content: WebContentExtraction
  ): Promise<void> {
    try {
      await db
        .update(bookmarks)
        .set({
          title: content.title || undefined,
          description: content.description || undefined,
          content: content.content || undefined,
          favicon: content.favicon || undefined,
          processingStatus: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(bookmarks.id, bookmarkId));
    } catch (error) {
      console.error(`Failed to update bookmark ${bookmarkId}:`, error);
      throw error;
    }
  }

  /**
   * 更新书签状态
   */
  private async updateBookmarkStatus(
    bookmarkId: string,
    userId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    try {
      await db
        .update(bookmarks)
        .set({
          processingStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(bookmarks.id, bookmarkId));
    } catch (error) {
      console.error(`Failed to update bookmark status ${bookmarkId}:`, error);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed:`, result);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    this.queue.on('error', (err) => {
      console.error('Queue error:', err);
    });
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats() {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  /**
   * 清理队列
   */
  async cleanup(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  /**
   * 重试失败的任务
   */
  async retryFailedJobs(): Promise<void> {
    const failedJobs = await this.queue.getFailed();
    for (const job of failedJobs) {
      await job.retry();
    }
  }

  /**
   * 暂停队列
   */
  async pause(): Promise<void> {
    await this.queue.pause();
  }

  /**
   * 恢复队列
   */
  async resume(): Promise<void> {
    await this.queue.resume();
  }
}

// 单例实例
let contentQueue: ContentExtractionQueue | null = null;

/**
 * 获取内容提取队列实例
 */
export function getContentQueue(redis?: Redis): ContentExtractionQueue {
  if (!contentQueue && redis) {
    contentQueue = new ContentExtractionQueue(redis);
  }
  if (!contentQueue) {
    throw new Error(
      'Content queue not initialized. Please provide Redis instance.'
    );
  }
  return contentQueue;
}

/**
 * 初始化内容提取队列
 */
export function initializeContentQueue(redis: Redis): ContentExtractionQueue {
  contentQueue = new ContentExtractionQueue(redis);
  return contentQueue;
}
