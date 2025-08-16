import { Context, Next } from 'hono';
import Redis from 'ioredis';
import { TooManyRequestsError } from './errorHandler';

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  message?: string; // 自定义错误消息
  skipSuccessfulRequests?: boolean; // 是否跳过成功请求
  skipFailedRequests?: boolean; // 是否跳过失败请求
}

/**
 * 速率限制层级配置
 */
export const RATE_LIMIT_TIERS = {
  // 默认限制：每分钟100个请求
  default: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later',
  },
  // 认证用户：每分钟300个请求
  authenticated: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 300,
    message: 'Too many requests, please try again later',
  },
  // 严格限制：每分钟10个请求（用于敏感操作）
  strict: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 10,
    message: 'Rate limit exceeded for this operation',
  },
  // 认证相关：每小时5个请求（登录、注册等）
  auth: {
    windowMs: 60 * 60 * 1000, // 1小时
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later',
  },
} as const;

/**
 * IP 白名单
 */
const IP_WHITELIST = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
  // 可以添加更多白名单IP
]);

/**
 * Redis 连接实例
 */
let redisClient: Redis | null = null;

/**
 * 初始化 Redis 连接
 */
export function initializeRedis() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected for rate limiting');
    });
  }
  return redisClient;
}

/**
 * 获取客户端标识符
 */
function getClientIdentifier(c: Context, tier: string): string {
  // 优先使用用户ID（如果已认证）
  const user = c.get('user');
  if (user && tier === 'authenticated') {
    return `user:${user.id}`;
  }

  // 使用IP地址
  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : c.req.header('x-real-ip') || c.env?.ip || 'unknown';

  return `ip:${ip}`;
}

/**
 * 检查IP是否在白名单中
 */
function isWhitelisted(c: Context): boolean {
  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : c.req.header('x-real-ip') || c.env?.ip || 'unknown';

  return IP_WHITELIST.has(ip);
}

/**
 * 滑动窗口速率限制实现
 */
async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const redis = initializeRedis();
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `rate_limit:${identifier}`;

  try {
    // 使用 Redis 事务确保原子性
    const pipeline = redis.pipeline();

    // 清理过期记录
    pipeline.zremrangebyscore(key, 0, windowStart);

    // 获取当前窗口内的请求数
    pipeline.zcard(key);

    // 添加当前请求
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // 设置过期时间
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline execution failed');
    }

    const currentCount = (results[1][1] as number) || 0;
    const allowed = currentCount < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount - 1);
    const resetTime = now + config.windowMs;

    // 如果超过限制，移除刚添加的请求
    if (!allowed) {
      await redis.zrem(key, `${now}-${Math.random()}`);
    }

    return { allowed, remaining, resetTime };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // 如果 Redis 失败，允许请求通过（优雅降级）
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }
}

/**
 * 创建速率限制中间件
 */
export function createRateLimit(
  tier: keyof typeof RATE_LIMIT_TIERS,
  customConfig?: Partial<RateLimitConfig>
) {
  const config = { ...RATE_LIMIT_TIERS[tier], ...customConfig };

  return async (c: Context, next: Next) => {
    // 检查白名单
    if (isWhitelisted(c)) {
      return await next();
    }

    const identifier = getClientIdentifier(c, tier);
    const { allowed, remaining, resetTime } = await checkRateLimit(
      identifier,
      config
    );

    // 设置速率限制头部
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

    if (!allowed) {
      c.header('Retry-After', Math.ceil(config.windowMs / 1000).toString());
      throw new TooManyRequestsError(config.message);
    }

    await next();
  };
}

/**
 * 预定义的速率限制中间件
 */
export const rateLimiters = {
  default: createRateLimit('default'),
  authenticated: createRateLimit('authenticated'),
  strict: createRateLimit('strict'),
  auth: createRateLimit('auth'),
};

/**
 * 清理 Redis 连接
 */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
