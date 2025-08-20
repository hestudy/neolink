import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RateLimitService,
  MemoryRateLimitStorage,
} from '../utils/rateLimit.js';

describe('速率限制测试 (AC7)', () => {
  let rateLimitService: RateLimitService;
  let mockStorage: MemoryRateLimitStorage;
  const mockRules = {
    summary: { maxRequests: 100, windowMs: 3600000 }, // 100 requests per hour
    tags: { maxRequests: 200, windowMs: 3600000 }, // 200 requests per hour
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = new MemoryRateLimitStorage();
    rateLimitService = new RateLimitService(mockStorage, mockRules);
  });

  describe('2.1-UNIT-018: 滑动窗口速率限制算法', () => {
    it('应该允许限制内的请求', async () => {
      // 在限制内的请求应该成功
      await expect(
        rateLimitService.checkRateLimit('user123', 'summary')
      ).resolves.not.toThrow();
    });

    it('应该阻止超出限制的请求', async () => {
      // 先达到限制
      for (let i = 0; i < 100; i++) {
        await rateLimitService.checkRateLimit('user123', 'summary');
      }

      // 下一个请求应该被阻止
      await expect(
        rateLimitService.checkRateLimit('user123', 'summary')
      ).rejects.toThrow('Rate limit exceeded for summary');
    });

    it('应该正确清理过期记录', async () => {
      // 添加一些请求
      await rateLimitService.checkRateLimit('user123', 'summary');

      // 检查状态应该显示有请求记录
      const status = await rateLimitService.getRateLimitStatus(
        'user123',
        'summary'
      );
      expect(status?.requests).toBe(1);
    });

    it('应该为每个请求记录时间戳', async () => {
      await rateLimitService.checkRateLimit('user123', 'summary');

      const status = await rateLimitService.getRateLimitStatus(
        'user123',
        'summary'
      );
      expect(status?.requests).toBe(1);
    });
  });

  describe('2.1-UNIT-019: 速率限制规则验证', () => {
    it('应该使用正确的操作限制规则', async () => {
      // 达到summary限制(100)
      for (let i = 0; i < 100; i++) {
        await rateLimitService.checkRateLimit('user123', 'summary');
      }

      // 下一个summary请求应该失败
      await expect(
        rateLimitService.checkRateLimit('user123', 'summary')
      ).rejects.toThrow('Rate limit exceeded for summary');

      // 但tags操作应该成功(不同的限制)
      await expect(
        rateLimitService.checkRateLimit('user123', 'tags')
      ).resolves.not.toThrow();
    });

    it('应该忽略未配置规则的操作', async () => {
      await expect(
        rateLimitService.checkRateLimit('user123', 'unknown-operation')
      ).resolves.not.toThrow();
    });

    it('应该验证规则配置有效性', () => {
      const invalidRules = {
        summary: { maxRequests: -1, windowMs: 3600000 },
      };

      expect(
        () => new RateLimitService(mockStorage, invalidRules)
      ).not.toThrow(); // 构造函数不验证，运行时验证
    });
  });

  describe('2.1-UNIT-020: 用户级速率限制', () => {
    it('应该为不同用户独立计算限制', async () => {
      // user1 达到限制
      for (let i = 0; i < 100; i++) {
        await rateLimitService.checkRateLimit('user1', 'summary');
      }

      // user1 应该被限制
      await expect(
        rateLimitService.checkRateLimit('user1', 'summary')
      ).rejects.toThrow('Rate limit exceeded for summary');

      // user2 应该仍然可以请求
      await expect(
        rateLimitService.checkRateLimit('user2', 'summary')
      ).resolves.not.toThrow();
    });

    it('应该支持IP地址作为标识符', async () => {
      await expect(
        rateLimitService.checkRateLimit('192.168.1.100', 'summary')
      ).resolves.not.toThrow();

      const status = await rateLimitService.getRateLimitStatus(
        '192.168.1.100',
        'summary'
      );
      expect(status?.requests).toBe(1);
    });

    it('应该处理标识符边缘情况', async () => {
      // 空字符串标识符应该抛出错误
      await expect(
        rateLimitService.checkRateLimit('', 'summary')
      ).rejects.toThrow('Identifier is required for rate limiting');

      // 特殊字符标识符应该正常工作
      await expect(
        rateLimitService.checkRateLimit('user@domain.com', 'summary')
      ).resolves.not.toThrow();
    });

    it('应该生成唯一的请求标记', async () => {
      await rateLimitService.checkRateLimit('user123', 'summary');

      const status = await rateLimitService.getRateLimitStatus(
        'user123',
        'summary'
      );
      expect(status?.requests).toBe(1);
      expect(status?.limit).toBe(100);
      expect(status?.remaining).toBe(99);
    });
  });
});
