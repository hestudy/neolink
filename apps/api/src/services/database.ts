import { checkDatabaseConnection as dbCheck } from '@neolink/database';
import Redis from 'ioredis';

/**
 * Redis 连接配置
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: null, // BullMQ requires this to be null
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 60000, // 增加到60秒，支持长时间运行的队列任务
};

/**
 * 连接池配置
 */
const redisPoolConfig = {
  max: 20,
  min: 5,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  retryDelayRange: [1000, 10000],
};

/**
 * Redis 客户端实例
 */
export const redisClient = new Redis(redisConfig);

/**
 * Redis 连接池管理服务
 */
class RedisConnectionPool {
  private connections: Redis[] = [];
  private availableConnections: Redis[] = [];
  private usedConnections: Set<Redis> = new Set();

  constructor(private config: typeof redisPoolConfig) {
    this.initializePool();
  }

  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.config.min; i++) {
      const connection = new Redis(redisConfig);
      this.connections.push(connection);
      this.availableConnections.push(connection);
    }
  }

  async getConnection(): Promise<Redis> {
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop()!;
      this.usedConnections.add(connection);
      return connection;
    }

    if (this.connections.length < this.config.max) {
      const connection = new Redis(redisConfig);
      this.connections.push(connection);
      this.usedConnections.add(connection);
      return connection;
    }

    // 等待连接可用
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, this.config.acquireTimeoutMillis);

      const checkForConnection = () => {
        if (this.availableConnections.length > 0) {
          clearTimeout(timeout);
          const connection = this.availableConnections.pop()!;
          this.usedConnections.add(connection);
          resolve(connection);
        } else {
          setTimeout(checkForConnection, 100);
        }
      };

      checkForConnection();
    });
  }

  releaseConnection(connection: Redis): void {
    if (this.usedConnections.has(connection)) {
      this.usedConnections.delete(connection);
      this.availableConnections.push(connection);
    }
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.connections.map((conn) => conn.quit()));
    this.connections = [];
    this.availableConnections = [];
    this.usedConnections.clear();
  }

  getStats() {
    return {
      total: this.connections.length,
      available: this.availableConnections.length,
      used: this.usedConnections.size,
    };
  }
}

/**
 * Redis 连接池实例
 */
export const redisPool = new RedisConnectionPool(redisPoolConfig);

/**
 * 检查数据库连接状态
 * 使用 Drizzle ORM 进行真实的数据库连接测试
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    return await dbCheck();
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
};

/**
 * 检查 Redis 连接状态
 */
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis connection check failed:', error);
    return false;
  }
};

/**
 * Redis 健康检查
 */
export const getRedisHealth = async () => {
  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    const info = await redisClient.info('memory');
    const memoryUsage = info
      .split('\r\n')
      .find((line) => line.startsWith('used_memory_human:'))
      ?.split(':')[1];

    const poolStats = redisPool.getStats();

    return {
      status: 'healthy',
      latency,
      memoryUsage,
      poolStats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};
