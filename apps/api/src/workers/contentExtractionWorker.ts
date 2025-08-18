/**
 * 内容提取任务处理器
 * 处理异步网页内容提取任务
 */

import { Job } from 'bullmq';
import { ContentExtractionAdapter } from '@neolink/ai/services/ContentExtractionAdapter';
import { processingJobRepository } from '../repositories/ProcessingJobRepository';
import { db } from '@neolink/database/connection';
import { bookmarks } from '@neolink/database/schema';
import { eq } from 'drizzle-orm';
import { JobStatus } from '@neolink/database/schema';

/**
 * 内容提取任务数据接口
 */
export interface ContentExtractionJobData {
  bookmarkId: string;
  url: string;
  userId: string;
  priority?: number;
  options?: {
    enableScreenshots?: boolean;
    enableFullContent?: boolean;
    timeout?: number;
  };
}

/**
 * 内容提取结果接口
 */
export interface ContentExtractionResult {
  title?: string;
  description?: string;
  content?: string;
  favicon?: string;
  screenshot?: string;
  domain?: string;
  language?: string;
  wordCount?: number;
  readingTime?: number;
  extractedAt: string;
  processingTime: number;
}

/**
 * 内容提取任务处理器类
 */
export class ContentExtractionWorker {
  private contentExtractor: ContentExtractionAdapter;

  constructor() {
    this.contentExtractor = new ContentExtractionAdapter({
      timeout: 30000,
      enableScreenshots: true,
      enableFullContent: true,
    });
  }

  /**
   * 处理内容提取任务
   */
  async process(
    job: Job<ContentExtractionJobData>
  ): Promise<ContentExtractionResult> {
    const { bookmarkId, url, options: _options = {} } = job.data;
    const startTime = Date.now();

    console.log(
      `🔄 Processing content extraction job ${job.id} for bookmark ${bookmarkId}`
    );

    try {
      // 更新任务状态为处理中
      await this.updateJobStatus(job.id!, 'processing', {
        startedAt: new Date(),
      });

      // 更新进度
      await job.updateProgress(10);

      // 检查书签是否仍然存在
      const bookmark = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.id, bookmarkId))
        .limit(1);

      if (!bookmark.length) {
        throw new Error(`Bookmark ${bookmarkId} not found`);
      }

      await job.updateProgress(20);

      // 配置内容提取器
      // const extractorConfig = {
      //   timeout: options.timeout || 30000,
      //   enableScreenshots: options.enableScreenshots ?? true,
      //   enableFullContent: options.enableFullContent ?? true,
      // };

      // 执行内容提取
      console.log(`📄 Extracting content from: ${url}`);
      await job.updateProgress(30);

      const extractedContent = await this.contentExtractor.extractContent(url);
      await job.updateProgress(70);

      // 构建结果
      const result: ContentExtractionResult = {
        ...extractedContent,
        extractedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      };

      await job.updateProgress(80);

      // 更新书签信息
      const updateData: Partial<typeof bookmarks.$inferSelect> = {
        processingStatus: 'completed' as const,
      };

      if (extractedContent.title) {
        updateData.title = extractedContent.title;
      }
      if (extractedContent.description) {
        updateData.description = extractedContent.description;
      }
      if (extractedContent.favicon) {
        updateData.favicon = extractedContent.favicon;
      }

      await db
        .update(bookmarks)
        .set(updateData)
        .where(eq(bookmarks.id, bookmarkId));
      await job.updateProgress(90);

      // 更新任务状态为完成
      await this.updateJobStatus(job.id!, 'completed', {
        result,
        completedAt: new Date(),
      });

      await job.updateProgress(100);

      console.log(
        `✅ Content extraction job ${job.id} completed in ${result.processingTime}ms`
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // const processingTime = Date.now() - startTime;

      console.error(`❌ Content extraction job ${job.id} failed:`, error);

      // 更新任务状态为失败
      await this.updateJobStatus(job.id!, 'failed', {
        error: errorMessage,
        completedAt: new Date(),
      });

      // 更新书签状态为失败
      await db
        .update(bookmarks)
        .set({ processingStatus: 'failed' })
        .where(eq(bookmarks.id, bookmarkId));

      // 重新抛出错误以便 BullMQ 处理重试
      throw new Error(`Content extraction failed: ${errorMessage}`);
    }
  }

  /**
   * 更新任务状态
   */
  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    additionalData?: {
      result?: unknown;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    try {
      await processingJobRepository.updateStatus(jobId, status, additionalData);
    } catch (error) {
      console.error(`Failed to update job status for ${jobId}:`, error);
      // 不重新抛出错误，避免影响主要处理流程
    }
  }

  /**
   * 任务失败处理
   */
  async onFailed(
    job: Job<ContentExtractionJobData>,
    error: Error
  ): Promise<void> {
    const { bookmarkId } = job.data;

    console.error(
      `❌ Content extraction job ${job.id} failed permanently:`,
      error
    );

    try {
      // 增加重试次数
      await processingJobRepository.incrementAttempts(job.id!);

      // 检查是否超过最大重试次数
      const processingJob = await processingJobRepository.findById(job.id!);
      if (
        processingJob &&
        processingJob.attempts >= processingJob.maxAttempts
      ) {
        // 超过最大重试次数，标记为永久失败
        await this.updateJobStatus(job.id!, 'failed', {
          error: `Max attempts (${processingJob.maxAttempts}) exceeded: ${error.message}`,
          completedAt: new Date(),
        });

        // 更新书签状态
        await db
          .update(bookmarks)
          .set({ processingStatus: 'failed' })
          .where(eq(bookmarks.id, bookmarkId));
      }
    } catch (updateError) {
      console.error(`Failed to handle job failure for ${job.id}:`, updateError);
    }
  }

  /**
   * 任务完成处理
   */
  async onCompleted(
    job: Job<ContentExtractionJobData>,
    result: ContentExtractionResult
  ): Promise<void> {
    console.log(`✅ Content extraction job ${job.id} completed successfully`);
    console.log(`📊 Processing time: ${result.processingTime}ms`);
    console.log(`📄 Extracted title: ${result.title}`);
    console.log(`📝 Word count: ${result.wordCount}`);
  }

  /**
   * 任务进度处理
   */
  async onProgress(
    job: Job<ContentExtractionJobData>,
    progress: number
  ): Promise<void> {
    console.log(`📊 Content extraction job ${job.id} progress: ${progress}%`);
  }

  /**
   * 任务停滞处理
   */
  async onStalled(job: Job<ContentExtractionJobData>): Promise<void> {
    console.warn(`⏰ Content extraction job ${job.id} stalled`);

    try {
      // 重置任务状态
      await this.updateJobStatus(job.id!, 'pending');
    } catch (error) {
      console.error(`Failed to handle stalled job ${job.id}:`, error);
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      await this.contentExtractor.close();
      console.log('✅ Content extraction worker cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up content extraction worker:', error);
    }
  }
}

/**
 * 创建内容提取任务处理器实例
 */
export const createContentExtractionWorker = () => {
  const worker = new ContentExtractionWorker();

  return {
    process: worker.process.bind(worker),
    onFailed: worker.onFailed.bind(worker),
    onCompleted: worker.onCompleted.bind(worker),
    onProgress: worker.onProgress.bind(worker),
    onStalled: worker.onStalled.bind(worker),
    cleanup: worker.cleanup.bind(worker),
  };
};

// 导出任务处理器函数
export const processContentExtractionJob = async (
  job: Job<ContentExtractionJobData>
) => {
  const worker = new ContentExtractionWorker();
  return await worker.process(job);
};
