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
      timeout: 45000, // 增加到45秒给更多时间处理复杂页面
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
        attempts: 2, // 减少重试次数，避免长时间阻塞
        backoff: {
          type: 'exponential',
          delay: 5000, // 增加重试间隔
        },
        delay: 1000, // 添加作业延迟
      },
    });

    // 初始化工作器
    this.worker = new Worker<ContentExtractionJobData, ContentExtractionResult>(
      'content-extraction',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: 2, // 降低并发数，减少系统负载
        limiter: {
          max: 8, // 降低处理频率
          duration: 60000, // 每分钟最多处理8个任务
        },
        // 添加连接选项确保稳定性
        skipLockRenewal: false, // 确保锁会被更新
        skipStalledCheck: false, // 不跳过停滞检查
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
      delay: 1000, // 1秒延迟启动
      attempts: 2, // 最多重试2次
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  /**
   * 处理内容提取任务
   */
  private async processJob(
    job: Job<ContentExtractionJobData>
  ): Promise<ContentExtractionResult> {
    const { bookmarkId, url, userId } = job.data;
    const startTime = Date.now();

    try {
      console.log(
        `Processing content extraction for bookmark ${bookmarkId}, URL: ${url}`
      );

      // 设置超时保护
      const extractionPromise = this.contentExtractor.extractContent(url);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Content extraction timeout')),
          50000
        ); // 50秒硬超时
      });

      // 竞争执行，哪个先完成就用哪个
      const content = (await Promise.race([
        extractionPromise,
        timeoutPromise,
      ])) as WebContentExtraction;

      // 更新数据库中的书签信息
      await this.updateBookmarkContent(bookmarkId, userId, content);

      const processingTime = Date.now() - startTime;
      console.log(
        `Content extraction completed for bookmark ${bookmarkId} in ${processingTime}ms`
      );

      return {
        success: true,
        content,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(
        `Content extraction failed for bookmark ${bookmarkId} after ${processingTime}ms:`,
        error
      );

      // 更新书签状态为失败
      await this.updateBookmarkStatus(bookmarkId, userId, 'failed');

      // 根据错误类型返回不同的错误信息
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;

        // 超时错误特殊处理
        if (
          errorMessage.includes('timeout') ||
          errorMessage.includes('Timeout')
        ) {
          errorMessage = `Content extraction timeout (${processingTime}ms)`;
        }
      }

      return {
        success: false,
        error: errorMessage,
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
