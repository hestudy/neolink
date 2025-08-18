/**
 * 应用初始化服务
 * 负责启动时初始化 Redis、任务队列和工作器
 */

import { redisService } from './redis';
import { queueManager } from './taskQueue';
import { processContentExtractionJob } from '../workers/contentExtractionWorker';

/**
 * 应用初始化器类
 */
export class AppInitializer {
  private static instance: AppInitializer;
  private isInitialized = false;

  private constructor() {}

  /**
   * 获取应用初始化器单例实例
   */
  public static getInstance(): AppInitializer {
    if (!AppInitializer.instance) {
      AppInitializer.instance = new AppInitializer();
    }
    return AppInitializer.instance;
  }

  /**
   * 初始化应用
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ App already initialized');
      return;
    }

    try {
      console.log('🚀 Starting application initialization...');

      // 1. 初始化 Redis 连接
      await this.initializeRedis();

      // 2. 初始化任务队列
      await this.initializeTaskQueue();

      // 3. 注册工作器
      await this.registerWorkers();

      this.isInitialized = true;
      console.log('✅ Application initialization completed successfully');
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初始化 Redis 连接
   */
  private async initializeRedis(): Promise<void> {
    try {
      console.log('🔗 Initializing Redis connection...');
      await redisService.connectWithRetry(5, 1000);
      console.log('✅ Redis connection initialized');
    } catch (error) {
      console.error('❌ Redis initialization failed:', error);
      throw new Error(`Redis initialization failed: ${error}`);
    }
  }

  /**
   * 初始化任务队列
   */
  private async initializeTaskQueue(): Promise<void> {
    try {
      console.log('📋 Initializing task queue...');
      await queueManager.initialize();
      console.log('✅ Task queue initialized');
    } catch (error) {
      console.error('❌ Task queue initialization failed:', error);
      throw new Error(`Task queue initialization failed: ${error}`);
    }
  }

  /**
   * 注册工作器
   */
  private async registerWorkers(): Promise<void> {
    try {
      console.log('👷 Registering workers...');

      // 注册内容提取工作器
      queueManager.registerWorker(
        'content-extraction',
        processContentExtractionJob,
        {
          concurrency: 2, // 并发处理2个任务
          limiter: {
            max: 10, // 每分钟最多处理10个任务
            duration: 60000,
          },
        }
      );

      console.log('✅ Workers registered successfully');
    } catch (error) {
      console.error('❌ Worker registration failed:', error);
      throw new Error(`Worker registration failed: ${error}`);
    }
  }

  /**
   * 优雅关闭应用
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.log('⚠️ App not initialized, nothing to shutdown');
      return;
    }

    try {
      console.log('🛑 Starting graceful shutdown...');

      // 1. 关闭队列管理器（包括工作器）
      await this.shutdownTaskQueue();

      // 2. 关闭 Redis 连接
      await this.shutdownRedis();

      this.isInitialized = false;
      console.log('✅ Graceful shutdown completed');
    } catch (error) {
      console.error('❌ Shutdown failed:', error);
      throw error;
    }
  }

  /**
   * 关闭任务队列
   */
  private async shutdownTaskQueue(): Promise<void> {
    try {
      console.log('📋 Shutting down task queue...');
      await queueManager.close();
      console.log('✅ Task queue shutdown completed');
    } catch (error) {
      console.error('❌ Task queue shutdown failed:', error);
      // 不重新抛出错误，继续其他清理工作
    }
  }

  /**
   * 关闭 Redis 连接
   */
  private async shutdownRedis(): Promise<void> {
    try {
      console.log('🔗 Shutting down Redis connection...');
      await redisService.disconnect();
      console.log('✅ Redis shutdown completed');
    } catch (error) {
      console.error('❌ Redis shutdown failed:', error);
      // 不重新抛出错误，继续其他清理工作
    }
  }

  /**
   * 检查初始化状态
   */
  public isAppInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    redis: boolean;
    taskQueue: boolean;
    overall: boolean;
  }> {
    const health = {
      redis: false,
      taskQueue: false,
      overall: false,
    };

    try {
      // 检查 Redis
      health.redis = await redisService.isReady();
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    try {
      // 检查任务队列（通过获取队列统计）
      const stats = await queueManager.getAllQueueStats();
      health.taskQueue = Object.keys(stats).length >= 0; // 至少能获取到统计信息
    } catch (error) {
      console.error('Task queue health check failed:', error);
    }

    health.overall = health.redis && health.taskQueue;
    return health;
  }

  /**
   * 重启服务
   */
  public async restart(): Promise<void> {
    console.log('🔄 Restarting application services...');

    try {
      await this.shutdown();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待1秒
      await this.initialize();
      console.log('✅ Application restart completed');
    } catch (error) {
      console.error('❌ Application restart failed:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const appInitializer = AppInitializer.getInstance();

// 导出便捷函数
export const initializeApp = () => appInitializer.initialize();
export const shutdownApp = () => appInitializer.shutdown();
export const restartApp = () => appInitializer.restart();
export const isAppInitialized = () => appInitializer.isAppInitialized();
export const appHealthCheck = () => appInitializer.healthCheck();

/**
 * 设置进程信号处理器
 */
export function setupGracefulShutdown(): void {
  // 处理 SIGTERM 信号（Docker 停止容器时发送）
  process.on('SIGTERM', async () => {
    console.log('📡 Received SIGTERM signal, starting graceful shutdown...');
    try {
      await appInitializer.shutdown();
      process.exit(0);
    } catch (error) {
      console.error('❌ Graceful shutdown failed:', error);
      process.exit(1);
    }
  });

  // 处理 SIGINT 信号（Ctrl+C）
  process.on('SIGINT', async () => {
    console.log('📡 Received SIGINT signal, starting graceful shutdown...');
    try {
      await appInitializer.shutdown();
      process.exit(0);
    } catch (error) {
      console.error('❌ Graceful shutdown failed:', error);
      process.exit(1);
    }
  });

  // 处理未捕获的异常
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught exception:', error);
    try {
      await appInitializer.shutdown();
    } catch (shutdownError) {
      console.error(
        '❌ Shutdown after uncaught exception failed:',
        shutdownError
      );
    }
    process.exit(1);
  });

  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    try {
      await appInitializer.shutdown();
    } catch (shutdownError) {
      console.error(
        '❌ Shutdown after unhandled rejection failed:',
        shutdownError
      );
    }
    process.exit(1);
  });

  console.log('✅ Graceful shutdown handlers registered');
}
