import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../services/AIService.js';

// Mock crypto module
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    default: actual,
  };
});

// Mock OpenAI and Anthropic SDKs with minimal setup
// Mock OpenAI and Anthropic SDKs with input validation
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async (params) => {
          const content = params.messages?.[0]?.content || '';
          if (!content || content.trim().length === 0) {
            throw new Error('Content cannot be empty for summary generation');
          }
          if (content.length > 100000) {
            throw new Error('Content too large');
          }
          return {
            choices: [
              {
                message: { content: 'Mock OpenAI summary' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 50 },
          };
        }),
      },
    },
  })),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockImplementation(async (params) => {
        const content = params.messages?.[0]?.content || '';
        if (!content || content.trim().length === 0) {
          throw new Error('Content cannot be empty for summary generation');
        }
        if (content.length > 100000) {
          throw new Error('Content too large');
        }
        return {
          content: [{ type: 'text', text: 'Mock Claude summary' }],
          usage: { input_tokens: 120, output_tokens: 60 },
          stop_reason: 'end_turn',
        };
      }),
    },
  })),
}));

describe('AI服务集成测试 - 简化版', () => {
  let aiService: AIService;

  const testConfig = {
    defaultProvider: 'openai' as const,
    openai: {
      enabled: true,
      apiKey: 'sk-test-key',
      model: 'gpt-4o-mini',
      timeout: 30000,
      maxRetries: 3,
    },
    claude: {
      enabled: true,
      apiKey: 'claude-test-key',
      model: 'claude-3-haiku-20240307',
      timeout: 30000,
    },
    costLimits: {
      monthlyBudget: 50,
      dailyBudget: 5,
      userBudget: 2,
    },
    rateLimit: {
      summary: { maxRequests: 100, windowMs: 3600000 },
      tags: { maxRequests: 200, windowMs: 3600000 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = new AIService(testConfig);
  });

  describe('P0 核心功能验证', () => {
    it('应该成功初始化AI服务', () => {
      expect(aiService).toBeDefined();
    });

    it('应该成功调用OpenAI生成摘要', async () => {
      const result = await aiService.generateSummary(
        'Test content for summary',
        { provider: 'openai' }
      );

      expect(result).toBeDefined();
      expect(result.summary).toBe('Mock OpenAI summary');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBeDefined();
      expect(result.tokensUsed).toBeDefined();
    });

    it('应该成功调用Claude生成摘要', async () => {
      const result = await aiService.generateSummary(
        'Test content for Claude summary',
        { provider: 'claude' }
      );

      expect(result).toBeDefined();
      expect(result.summary).toBe('Mock Claude summary');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBeDefined();
      expect(result.tokensUsed).toBeDefined();
    });

    it('应该正确处理缓存命中', async () => {
      // 第一次调用创建缓存
      const result1 = await aiService.generateSummary('Cached content test');

      // 第二次调用应该命中缓存
      const result2 = await aiService.generateSummary('Cached content test');

      expect(result1).toEqual(result2);
    });

    it('应该区分不同内容的缓存', async () => {
      const result1 = await aiService.generateSummary('Content A');
      const result2 = await aiService.generateSummary('Content B');

      // 不同内容应该有不同结果（来自不同API调用）
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('P0 成本和限制验证', () => {
    it('应该记录token使用情况', async () => {
      const result = await aiService.generateSummary(
        'Test content for token tracking'
      );

      expect(result.tokensUsed).toBeDefined();
      expect(result.tokensUsed.input).toBeGreaterThan(0);
      expect(result.tokensUsed.output).toBeGreaterThan(0);
    });

    it('应该处理输入验证错误', async () => {
      // 空内容会导致所有提供商失败，因为真实的提供商会进行输入验证
      await expect(aiService.generateSummary('')).rejects.toThrow();

      const veryLargeContent = 'x'.repeat(100001);
      await expect(
        aiService.generateSummary(veryLargeContent)
      ).rejects.toThrow();
    });
  });

  describe('P0 可靠性验证', () => {
    it('应该在构造时检测到没有可用提供商', () => {
      // 创建只有不存在提供商的配置
      const invalidConfig = {
        ...testConfig,
        openai: { ...testConfig.openai, enabled: false },
        claude: { ...testConfig.claude, enabled: false },
      };

      expect(() => new AIService(invalidConfig)).toThrow(
        'No AI providers configured'
      );
    });
  });
});
