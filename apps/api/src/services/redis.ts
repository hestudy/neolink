/**
 * Redis 连接和管理服务
 * 提供 Redis 连接池、健康检查和基础操作
 */

import Redis from 'ioredis';

/**
 * Redis 连接配置接口
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  retryDelayOnFailover: number;
  connectTimeout: number;
  commandTimeout: number;
}

/**
 * Redis 连接池配置
 */
export interface RedisPoolConfig {
  max: number;
  min: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  retryDelayRange: [number, number];
}

/**
 * Redis 健康状态
 */
export interface RedisHealth {
  connected: boolean;
  memory: {
    used: string;
    peak: string;
    fragmentation: string;
  };
  stats: {
    totalConnections: string;
    connectedClients: string;
    blockedClients: string;
  };
  keyspace: {
    db0?: {
      keys: number;
      expires: number;
    };
  };
  timestamp: string;
}

/**
 * Redis 连接管理服务
 */
export class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;
  private config: RedisConfig;
  private isConnected = false;

  private constructor() {
    this.config = this.parseRedisConfig();
  }

  /**
   * 获取 Redis 服务单例实例
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * 解析 Redis 配置
   */
  private parseRedisConfig(): RedisConfig {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const url = new URL(redisUrl);

    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || 6379,
      password: url.password || process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryDelayOnFailover: 100,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
  }

  /**
   * 初始化 Redis 连接
   */
  public async connect(): Promise<Redis> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      this.client = new Redis(this.config);

      // 设置事件监听器
      this.setupEventListeners();

      // 测试连接
      await this.client.ping();
      this.isConnected = true;

      console.log('✅ Redis connected successfully');
      return this.client;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw new Error(`Redis connection failed: ${error}`);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('🔗 Redis connecting...');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('🔌 Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (delay: number) => {
      console.log(`🔄 Redis reconnecting in ${delay}ms...`);
    });

    this.client.on('end', () => {
      console.log('🔚 Redis connection ended');
      this.isConnected = false;
    });
  }

  /**
   * 获取 Redis 客户端实例
   */
  public getClient(): Redis {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * 检查 Redis 连接状态
   */
  public async isReady(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * 获取 Redis 健康状态
   */
  public async getHealth(): Promise<RedisHealth> {
    try {
      const client = this.getClient();

      // 获取内存信息
      // const memoryInfo = await client.memory('usage');
      const info = await client.info();

      // 解析信息
      const memorySection = this.parseInfoSection(info, 'memory');
      const clientsSection = this.parseInfoSection(info, 'clients');
      const keyspaceSection = this.parseInfoSection(info, 'keyspace');

      return {
        connected: this.isConnected,
        memory: {
          used: memorySection.used_memory_human || '0B',
          peak: memorySection.used_memory_peak_human || '0B',
          fragmentation: memorySection.mem_fragmentation_ratio || '1.0',
        },
        stats: {
          totalConnections: clientsSection.total_connections_received || '0',
          connectedClients: clientsSection.connected_clients || '0',
          blockedClients: clientsSection.blocked_clients || '0',
        },
        keyspace: this.parseKeyspace(keyspaceSection),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get Redis health:', error);
      return {
        connected: false,
        memory: { used: '0B', peak: '0B', fragmentation: '1.0' },
        stats: {
          totalConnections: '0',
          connectedClients: '0',
          blockedClients: '0',
        },
        keyspace: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 解析 Redis INFO 命令的特定部分
   */
  private parseInfoSection(
    info: string,
    section: string
  ): Record<string, string> {
    const lines = info.split('\r\n');
    const sectionStart = lines.findIndex((line) =>
      line.startsWith(`# ${section.charAt(0).toUpperCase() + section.slice(1)}`)
    );

    if (sectionStart === -1) return {};

    const result: Record<string, string> = {};
    for (let i = sectionStart + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#') || line === '') break;

      const [key, value] = line.split(':');
      if (key && value) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 解析 keyspace 信息
   */
  private parseKeyspace(
    keyspaceSection: Record<string, string>
  ): RedisHealth['keyspace'] {
    const result: RedisHealth['keyspace'] = {};

    for (const [key, value] of Object.entries(keyspaceSection)) {
      if (key.startsWith('db')) {
        const matches = value.match(/keys=(\d+),expires=(\d+)/);
        if (matches) {
          result[key as 'db0'] = {
            keys: parseInt(matches[1]),
            expires: parseInt(matches[2]),
          };
        }
      }
    }

    return result;
  }

  /**
   * 重连 Redis
   */
  public async reconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.disconnect();
      }
      await this.connect();
    } catch (error) {
      console.error('Redis reconnection failed:', error);
      throw error;
    }
  }

  /**
   * 关闭 Redis 连接
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
        this.isConnected = false;
        console.log('✅ Redis disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting Redis:', error);
      throw error;
    }
  }

  /**
   * 连接重试机制
   */
  public async connectWithRetry(maxRetries = 5, delay = 1000): Promise<Redis> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.connect();
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to connect to Redis after ${maxRetries} attempts: ${error}`
          );
        }

        console.log(
          `Redis connection attempt ${attempt} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // 指数退避
      }
    }

    throw new Error('This should never be reached');
  }
}

// 导出单例实例
export const redisService = RedisService.getInstance();

// 导出便捷函数
export const getRedisClient = () => redisService.getClient();
export const connectRedis = () => redisService.connect();
export const isRedisReady = () => redisService.isReady();
export const getRedisHealth = () => redisService.getHealth();
