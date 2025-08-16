import { Hono } from 'hono';
import type { HealthCheckResponse } from '@neolink/shared';
import { checkDatabaseConnection } from '../services/database';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  try {
    const timestamp = new Date().toISOString();
    const version = '0.1.0';

    // 检查数据库连接
    const databaseStatus = await checkDatabaseConnection();

    const response: HealthCheckResponse = {
      status: databaseStatus ? 'ok' : 'error',
      timestamp,
      version,
      services: {
        database: databaseStatus ? 'connected' : 'disconnected',
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
      },
    };

    return c.json(errorResponse, 503);
  }
});
