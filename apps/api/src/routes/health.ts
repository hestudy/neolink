import { Hono } from 'hono';
import type { HealthCheckResponse } from '@neolink/shared';
import {
  checkDatabaseConnection,
  checkRedisConnection,
  getRedisHealth,
} from '../services/database';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  try {
    const timestamp = new Date().toISOString();
    const version = '0.1.0';

    // 检查数据库连接
    const databaseStatus = await checkDatabaseConnection();

    // 检查 Redis 连接
    const redisStatus = await checkRedisConnection();

    const allServicesHealthy = databaseStatus && redisStatus;

    const response: HealthCheckResponse = {
      status: allServicesHealthy ? 'ok' : 'error',
      timestamp,
      version,
      services: {
        database: databaseStatus ? 'connected' : 'disconnected',
        redis: redisStatus ? 'connected' : 'disconnected',
      },
    };

    const statusCode = response.status === 'ok' ? 200 : 503;

    return c.json(response, statusCode);
  } catch (error) {
    console.error('Health check error:', error);

    const errorResponse: HealthCheckResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      services: {
        database: 'disconnected',
        redis: 'disconnected',
      },
    };

    return c.json(errorResponse, 503);
  }
});

// Redis 详细健康检查端点
healthRoute.get('/redis', async (c) => {
  try {
    const health = await getRedisHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    return c.json(health, statusCode);
  } catch (error) {
    console.error('Redis health check error:', error);
    return c.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});
