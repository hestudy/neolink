/**
 * BullMQ 任务队列服务
 * 提供任务队列管理、任务处理和监控功能
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { redisClient } from './database';

/**
 * 任务类型枚举
 */
export enum JobType {
  CONTENT_EXTRACTION = 'content_extraction',
  SCREENSHOT = 'screenshot',
  AI_SUMMARY = 'ai_summary',
  AI_TAGS = 'ai_tags',
  VECTOR_EMBEDDING = 'vector_embedding',
}

/**
 * 任务状态枚举
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 任务选项接口
 */
export interface TaskJobOptions extends JobsOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  timeout?: number;
}

/**
 * 队列统计信息
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * 任务处理器函数类型
 */
export type JobProcessor<T = unknown, R = unknown> = (
  job: Job<T>
) => Promise<R>;

/**
 * 任务队列服务类
 */
export class TaskQueueService {
  private static instance: TaskQueueService;
  private redis: Redis | null = null;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private isInitialized = false;

  private constructor() {}

  /**
   * 获取任务队列服务单例实例
   */
  public static getInstance(): TaskQueueService {
    if (!TaskQueueService.instance) {
      TaskQueueService.instance = new TaskQueueService();
    }
    return TaskQueueService.instance;
  }

  /**
   * 初始化任务队列服务
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 使用已配置的 Redis 连接
      this.redis = redisClient;
      this.isInitialized = true;
      console.log('✅ TaskQueue service initialized');
    } catch (error) {
      console.error('❌ TaskQueue service initialization failed:', error);
      throw error;
    }
  }

  /**
   * 创建或获取队列
   */
  public getQueue(queueName: string): Queue {
    if (!this.isInitialized || !this.redis) {
      throw new Error(
        'TaskQueue service not initialized. Call initialize() first.'
      );
    }

    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: 100, // 保留最近100个完成的任务
          removeOnFail: 50, // 保留最近50个失败的任务
          attempts: 3, // 默认重试3次
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      this.queues.set(queueName, queue);
      console.log(`📋 Queue '${queueName}' created`);
    }

    return this.queues.get(queueName)!;
  }

  /**
   * 添加任务到队列
   */
  public async addJob<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options?: TaskJobOptions
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);

    try {
      const job = await queue.add(jobName, data, options);
      console.log(
        `📝 Job '${jobName}' added to queue '${queueName}' with ID: ${job.id}`
      );
      return job;
    } catch (error) {
      console.error(
        `❌ Failed to add job '${jobName}' to queue '${queueName}':`,
        error
      );
      throw error;
    }
  }

  /**
   * 创建任务处理器
   */
  public createWorker<T = unknown, R = unknown>(
    queueName: string,
    processor: JobProcessor<T, R>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Worker<T, R> {
    if (!this.isInitialized || !this.redis) {
      throw new Error(
        'TaskQueue service not initialized. Call initialize() first.'
      );
    }

    if (this.workers.has(queueName)) {
      console.warn(`⚠️ Worker for queue '${queueName}' already exists`);
      return this.workers.get(queueName)! as Worker<T, R>;
    }

    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.redis,
      concurrency: options?.concurrency || 1,
      limiter: options?.limiter,
    });

    // 设置事件监听器
    this.setupWorkerEventListeners(worker, queueName);

    this.workers.set(queueName, worker);
    console.log(`👷 Worker for queue '${queueName}' created`);

    return worker;
  }

  /**
   * 设置工作器事件监听器
   */
  private setupWorkerEventListeners(worker: Worker, queueName: string): void {
    worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} in queue '${queueName}' completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} in queue '${queueName}' failed:`, err);
    });

    worker.on('progress', (job, progress) => {
      console.log(
        `📊 Job ${job.id} in queue '${queueName}' progress: ${progress}%`
      );
    });

    worker.on('error', (err) => {
      console.error(`❌ Worker error in queue '${queueName}':`, err);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`⏰ Job ${jobId} in queue '${queueName}' stalled`);
    });
  }

  /**
   * 获取任务状态
   */
  public async getJobStatus(
    queueName: string,
    jobId: string
  ): Promise<JobStatus | null> {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) return null;

      if (await job.isCompleted()) return JobStatus.COMPLETED;
      if (await job.isFailed()) return JobStatus.FAILED;
      if (await job.isActive()) return JobStatus.PROCESSING;
      if (await job.isWaiting()) return JobStatus.PENDING;

      return JobStatus.PENDING;
    } catch (error) {
      console.error(`Failed to get job status for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * 获取任务详情
   */
  public async getJob(
    queueName: string,
    jobId: string
  ): Promise<Job<unknown> | null> {
    try {
      const queue = this.getQueue(queueName);
      return await queue.getJob(jobId);
    } catch (error) {
      console.error(`Failed to get job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * 获取队列统计信息
   */
  public async getQueueStats(queueName: string): Promise<QueueStats> {
    try {
      const queue = this.getQueue(queueName);

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      const isPaused = await queue.isPaused();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: isPaused,
      };
    } catch (error) {
      console.error(`Failed to get queue stats for '${queueName}':`, error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
      };
    }
  }

  /**
   * 暂停队列
   */
  public async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    console.log(`⏸️ Queue '${queueName}' paused`);
  }

  /**
   * 恢复队列
   */
  public async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    console.log(`▶️ Queue '${queueName}' resumed`);
  }

  /**
   * 清空队列
   */
  public async cleanQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
    console.log(`🧹 Queue '${queueName}' cleaned`);
  }

  /**
   * 获取所有队列名称
   */
  public getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * 关闭所有队列和工作器
   */
  public async close(): Promise<void> {
    try {
      // 关闭所有工作器
      for (const [name, worker] of this.workers) {
        await worker.close();
        console.log(`👷 Worker '${name}' closed`);
      }

      // 关闭所有队列事件监听器
      for (const [name, queueEvents] of this.queueEvents) {
        await queueEvents.close();
        console.log(`📡 QueueEvents '${name}' closed`);
      }

      // 关闭所有队列
      for (const [name, queue] of this.queues) {
        await queue.close();
        console.log(`📋 Queue '${name}' closed`);
      }

      // 清空映射
      this.workers.clear();
      this.queueEvents.clear();
      this.queues.clear();

      this.isInitialized = false;
      console.log('✅ TaskQueue service closed');
    } catch (error) {
      console.error('❌ Error closing TaskQueue service:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const taskQueueService = TaskQueueService.getInstance();

/**
 * 队列管理服务
 * 提供高级队列管理功能
 */
export class QueueManager {
  private static instance: QueueManager;
  private taskQueue: TaskQueueService;
  private workers: Map<string, unknown> = new Map();

  private constructor() {
    this.taskQueue = TaskQueueService.getInstance();
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * 初始化队列管理器
   */
  async initialize(): Promise<void> {
    await this.taskQueue.initialize();
    console.log('✅ Queue manager initialized');
  }

  /**
   * 添加内容提取任务
   */
  async addContentExtractionJob(
    bookmarkId: string,
    url: string,
    userId: string,
    options?: {
      priority?: number;
      delay?: number;
      enableScreenshots?: boolean;
      enableFullContent?: boolean;
      timeout?: number;
    }
  ): Promise<Job> {
    const jobData = {
      bookmarkId,
      url,
      userId,
      options: {
        enableScreenshots: options?.enableScreenshots ?? true,
        enableFullContent: options?.enableFullContent ?? true,
        timeout: options?.timeout ?? 30000,
      },
    };

    const jobOptions: TaskJobOptions = {
      priority: options?.priority ?? 0,
      delay: options?.delay ?? 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      timeout: 60000, // 1分钟总超时
    };

    return await this.taskQueue.addJob(
      'content-extraction',
      JobType.CONTENT_EXTRACTION,
      jobData,
      jobOptions
    );
  }

  /**
   * 注册工作器
   */
  registerWorker<T = unknown, R = unknown>(
    queueName: string,
    processor: JobProcessor<T, R>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): void {
    if (this.workers.has(queueName)) {
      console.warn(`⚠️ Worker for queue '${queueName}' already registered`);
      return;
    }

    const worker = this.taskQueue.createWorker(queueName, processor, options);
    this.workers.set(queueName, worker);
    console.log(`👷 Worker registered for queue: ${queueName}`);
  }

  /**
   * 获取所有队列状态
   */
  async getAllQueueStats(): Promise<Record<string, QueueStats>> {
    const queueNames = this.taskQueue.getQueueNames();
    const stats: Record<string, QueueStats> = {};

    for (const queueName of queueNames) {
      stats[queueName] = await this.taskQueue.getQueueStats(queueName);
    }

    return stats;
  }

  /**
   * 暂停所有队列
   */
  async pauseAllQueues(): Promise<void> {
    const queueNames = this.taskQueue.getQueueNames();

    for (const queueName of queueNames) {
      await this.taskQueue.pauseQueue(queueName);
    }

    console.log('⏸️ All queues paused');
  }

  /**
   * 恢复所有队列
   */
  async resumeAllQueues(): Promise<void> {
    const queueNames = this.taskQueue.getQueueNames();

    for (const queueName of queueNames) {
      await this.taskQueue.resumeQueue(queueName);
    }

    console.log('▶️ All queues resumed');
  }

  /**
   * 关闭队列管理器
   */
  async close(): Promise<void> {
    // 清理工作器
    for (const [queueName, worker] of this.workers) {
      try {
        await (worker as unknown as Worker<unknown, unknown>).close();
        console.log(`👷 Worker '${queueName}' closed`);
      } catch (error) {
        console.error(`Error closing worker '${queueName}':`, error);
      }
    }

    this.workers.clear();

    // 关闭任务队列服务
    await this.taskQueue.close();

    console.log('✅ Queue manager closed');
  }
}

// 导出单例实例
export const queueManager = QueueManager.getInstance();

// 导出便捷函数
export const initializeTaskQueue = () => taskQueueService.initialize();
export const addJob = (
  queueName: string,
  jobName: string,
  data: unknown,
  options?: TaskJobOptions
) => taskQueueService.addJob(queueName, jobName, data, options);
export const createWorker = <T = unknown, R = unknown>(
  queueName: string,
  processor: JobProcessor<T, R>,
  options?: {
    concurrency?: number;
    limiter?: { max: number; duration: number };
  }
) => taskQueueService.createWorker(queueName, processor, options);
export const getQueueStats = (queueName: string) =>
  taskQueueService.getQueueStats(queueName);
