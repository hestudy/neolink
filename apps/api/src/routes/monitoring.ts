/**
 * 监控端点路由
 */

import { Hono } from 'hono';
import { taskQueueService, queueManager } from '../services/taskQueue';
import { checkRedisConnection, getRedisHealth } from '../services/database';
import { processingJobRepository } from '../repositories/ProcessingJobRepository';

const router = new Hono();

/**
 * 系统健康检查
 */
router.get('/health', async (c) => {
  try {
    // 检查各个服务状态
    const redisHealthy = await checkRedisConnection();

    const health = {
      status: redisHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        taskQueue: redisHealthy ? 'healthy' : 'unhealthy',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    return c.json(health, statusCode);
  } catch (error) {
    console.error('Health check failed:', error);
    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      503
    );
  }
});

/**
 * 系统指标
 */
router.get('/metrics', async (c) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    return c.json({
      status: 'success',
      data: metrics,
    });
  } catch (error) {
    console.error('Metrics check failed:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to get system metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * 任务队列状态监控
 */
router.get('/queues', async (c) => {
  try {
    const queueStats = await queueManager.getAllQueueStats();

    return c.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        queues: queueStats,
        queueNames: taskQueueService.getQueueNames(),
      },
    });
  } catch (error) {
    console.error('Queue monitoring failed:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to get queue status',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * 处理任务统计
 */
router.get('/jobs', async (c) => {
  try {
    const jobStats = await processingJobRepository.getStats();

    return c.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: jobStats,
    });
  } catch (error) {
    console.error('Job statistics failed:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to get job statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Redis 详细状态
 */
router.get('/redis', async (c) => {
  try {
    const redisHealth = await getRedisHealth();

    return c.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: redisHealth,
    });
  } catch (error) {
    console.error('Redis monitoring failed:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to get Redis status',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * 任务队列操作 - 暂停所有队列
 */
router.post('/queues/pause', async (c) => {
  try {
    await queueManager.pauseAllQueues();

    return c.json({
      status: 'success',
      message: 'All queues paused successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to pause queues:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to pause queues',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * 任务队列操作 - 恢复所有队列
 */
router.post('/queues/resume', async (c) => {
  try {
    await queueManager.resumeAllQueues();

    return c.json({
      status: 'success',
      message: 'All queues resumed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to resume queues:', error);
    return c.json(
      {
        status: 'error',
        message: 'Failed to resume queues',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default router;
