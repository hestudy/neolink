import { Context, Next } from 'hono';

/**
 * 请求监控中间件
 */
export function requestMonitoring() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    
    // 设置请求 ID
    c.set('requestId', requestId);
    
    // 记录请求开始
    console.log('Request started:', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      userAgent: c.req.header('user-agent'),
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
      timestamp: new Date().toISOString(),
    });

    await next();

    // 记录请求结束
    const duration = Date.now() - start;
    console.log('Request completed:', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * 健康监控类
 */
export class HealthMonitor {
  private static instance: HealthMonitor;
  private startTime: number;

  private constructor() {
    this.startTime = Date.now();
  }

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  async checkDatabase(): Promise<{ status: string; latency?: number }> {
    try {
      // TODO: 实现数据库健康检查
      const start = Date.now();
      // await db.raw('SELECT 1');
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  async checkRedis(): Promise<{ status: string; latency?: number }> {
    try {
      // TODO: 实现 Redis 健康检查
      const start = Date.now();
      // await redis.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      console.error('Redis health check failed:', error);
      return { status: 'unhealthy' };
    }
  }

  async getHealthStatus() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isHealthy = database.status === 'healthy' && redis.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime: this.getUptime(),
      services: {
        database: database.status,
        redis: redis.status,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
