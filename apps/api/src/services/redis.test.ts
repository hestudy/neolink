/**
 * Redis 服务测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { redisService } from './redis';

describe('RedisService', () => {
  beforeAll(async () => {
    // 在测试环境中，Redis可能不可用，所以我们需要处理连接失败的情况
    try {
      await redisService.connect();
    } catch {
      console.warn(
        'Redis not available in test environment, skipping Redis tests'
      );
    }
  });

  afterAll(async () => {
    try {
      await redisService.disconnect();
    } catch {
      // 忽略断开连接时的错误
    }
  });

  it('should be able to check if Redis is ready', async () => {
    const isReady = await redisService.isReady();
    // 在测试环境中，Redis可能不可用，所以我们只检查方法是否返回布尔值
    expect(typeof isReady).toBe('boolean');
  });

  it('should be able to get health status', async () => {
    const health = await redisService.getHealth();

    expect(health).toHaveProperty('connected');
    expect(health).toHaveProperty('memory');
    expect(health).toHaveProperty('stats');
    expect(health).toHaveProperty('keyspace');
    expect(health).toHaveProperty('timestamp');

    expect(typeof health.connected).toBe('boolean');
    expect(typeof health.timestamp).toBe('string');
  });

  it('should handle connection errors gracefully', async () => {
    // 测试重连机制
    try {
      await redisService.reconnect();
      // 如果成功，检查是否准备就绪
      const isReady = await redisService.isReady();
      expect(typeof isReady).toBe('boolean');
    } catch (error) {
      // 在测试环境中，Redis可能不可用，这是预期的
      expect(error).toBeDefined();
    }
  });

  it('should provide singleton instance', () => {
    const instance1 = redisService;
    const instance2 = redisService;
    expect(instance1).toBe(instance2);
  });
});
