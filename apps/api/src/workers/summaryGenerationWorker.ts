/**
 * AI 摘要生成任务处理器
 * 处理异步 AI 摘要生成任务
 */

import { Job } from 'bullmq';
import { AIService } from '@neolink/ai/services/AIService';
import { processingJobRepository } from '../repositories/ProcessingJobRepository';
import { db } from '@neolink/database/connection';
import { bookmarks } from '@neolink/database/schema';
import { eq } from 'drizzle-orm';
import { JobStatus } from '@neolink/database/schema';
import type { SummaryGenerationResult } from '@neolink/shared/types';

/**
 * 摘要生成任务数据接口
 */
export interface SummaryGenerationJobData {
  bookmarkId: string;
  content: string;
  language: string;
  userId: string;
  metadata?: {
    title?: string;
    description?: string;
  };
  options: {
    summaryLength: 'short' | 'medium' | 'long';
    maxLength?: number;
    provider?: 'openai' | 'claude';
  };
}

/**
 * 摘要生成任务处理器类
 */
export class SummaryGenerationWorker {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * 处理摘要生成任务
   */
  async process(
    job: Job<SummaryGenerationJobData>
  ): Promise<SummaryGenerationResult> {
    const { bookmarkId, content, language, userId, metadata, options } =
      job.data;
    const startTime = Date.now();

    console.log(
      `🔄 Processing summary generation job ${job.id} for bookmark ${bookmarkId}`
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

      // 验证输入内容
      if (!content?.trim()) {
        throw new Error('Content is empty or invalid');
      }

      await job.updateProgress(30);

      // 配置摘要生成选项
      const summaryOptions = {
        summaryLength: options.summaryLength,
        maxLength: options.maxLength || 4000,
        language: language,
        provider: options.provider,
      };

      console.log(
        `🤖 Generating summary with ${options.provider || 'default'} provider`
      );
      await job.updateProgress(40);

      // 生成摘要
      const summaryResult = await this.aiService.generateSummary(
        content,
        summaryOptions,
        userId,
        metadata
      );

      await job.updateProgress(80);

      // 构建结果
      const result: SummaryGenerationResult = {
        summary: summaryResult.summary,
        confidence: summaryResult.confidence,
        language: summaryResult.language,
        tokensUsed: summaryResult.tokensUsed || { input: 0, output: 0 },
        cost: this.calculateCost(
          summaryResult.tokensUsed || { input: 0, output: 0 },
          options.provider
        ),
        provider: options.provider || 'openai',
        generatedAt: new Date(),
      };

      await job.updateProgress(90);

      // 更新书签摘要信息
      const updateData: Partial<typeof bookmarks.$inferSelect> = {
        summary: result.summary,
        summaryMetadata: {
          version: 1,
          generatedAt: result.generatedAt,
          provider: result.provider,
          confidence: result.confidence,
          language: result.language,
          tokensUsed: result.tokensUsed.input + result.tokensUsed.output,
          cost: result.cost,
        },
      };

      await db
        .update(bookmarks)
        .set(updateData)
        .where(eq(bookmarks.id, bookmarkId));

      await job.updateProgress(95);

      // 更新任务状态为完成
      await this.updateJobStatus(job.id!, 'completed', {
        result,
        completedAt: new Date(),
      });

      await job.updateProgress(100);

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Summary generation job ${job.id} completed in ${processingTime}ms`
      );
      console.log(`📝 Generated summary (${result.summary.length} chars)`);
      console.log(`🎯 Confidence: ${result.confidence}`);
      console.log(`💰 Cost: $${result.cost.toFixed(4)}`);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error(`❌ Summary generation job ${job.id} failed:`, error);

      // 更新任务状态为失败
      await this.updateJobStatus(job.id!, 'failed', {
        error: errorMessage,
        completedAt: new Date(),
      });

      // 不更新书签状态，保持原状态以便重试

      // 重新抛出错误以便 BullMQ 处理重试
      throw new Error(`Summary generation failed: ${errorMessage}`);
    }
  }

  /**
   * 计算摘要生成成本（简化版本）
   */
  private calculateCost(
    tokensUsed: { input: number; output: number },
    provider?: string
  ): number {
    const rates = {
      openai: {
        input: 0.00015 / 1000, // GPT-4o-mini 输入价格 per token
        output: 0.0006 / 1000, // GPT-4o-mini 输出价格 per token
      },
      claude: {
        input: 0.00025 / 1000, // Claude Haiku 输入价格 per token
        output: 0.00125 / 1000, // Claude Haiku 输出价格 per token
      },
    };

    const rate = rates[provider as keyof typeof rates] || rates.openai;
    return tokensUsed.input * rate.input + tokensUsed.output * rate.output;
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
    job: Job<SummaryGenerationJobData>,
    error: Error
  ): Promise<void> {
    console.error(
      `❌ Summary generation job ${job.id} failed permanently:`,
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

        // 不更新书签状态，保持原状态以便手动重试
      }
    } catch (updateError) {
      console.error(`Failed to handle job failure for ${job.id}:`, updateError);
    }
  }

  /**
   * 任务完成处理
   */
  async onCompleted(
    job: Job<SummaryGenerationJobData>,
    result: SummaryGenerationResult
  ): Promise<void> {
    console.log(`✅ Summary generation job ${job.id} completed successfully`);
    console.log(`📝 Summary length: ${result.summary.length} characters`);
    console.log(`🎯 Confidence: ${result.confidence}`);
    console.log(`🌐 Language: ${result.language}`);
    console.log(
      `🔗 Tokens: ${result.tokensUsed.input + result.tokensUsed.output}`
    );
    console.log(`💰 Cost: $${result.cost.toFixed(4)}`);
  }

  /**
   * 任务进度处理
   */
  async onProgress(
    job: Job<SummaryGenerationJobData>,
    progress: number
  ): Promise<void> {
    console.log(`📊 Summary generation job ${job.id} progress: ${progress}%`);
  }

  /**
   * 任务停滞处理
   */
  async onStalled(job: Job<SummaryGenerationJobData>): Promise<void> {
    console.warn(`⏰ Summary generation job ${job.id} stalled`);

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
      // AI 服务清理（如需要）
      console.log('✅ Summary generation worker cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up summary generation worker:', error);
    }
  }
}

/**
 * 创建摘要生成任务处理器实例
 */
export const createSummaryGenerationWorker = (aiService: AIService) => {
  const worker = new SummaryGenerationWorker(aiService);

  return {
    process: worker.process.bind(worker),
    onFailed: worker.onFailed.bind(worker),
    onCompleted: worker.onCompleted.bind(worker),
    onProgress: worker.onProgress.bind(worker),
    onStalled: worker.onStalled.bind(worker),
    cleanup: worker.cleanup.bind(worker),
  };
};

/**
 * 导出任务处理器函数
 */
export const processSummaryGenerationJob = async (
  job: Job<SummaryGenerationJobData>,
  aiService: AIService
) => {
  const worker = new SummaryGenerationWorker(aiService);
  return await worker.process(job);
};
