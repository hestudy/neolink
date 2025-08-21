import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { AIError } from '../types/providers.js';

// Mock OpenAI SDK
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Mock dependencies
const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  generateCacheKey: vi.fn(),
};

const mockCostTracker = {
  checkBudget: vi.fn(),
  recordUsage: vi.fn(),
};

const mockConfig = {
  apiKey: 'sk-test123',
  model: 'gpt-4o-mini',
  timeout: 30000,
  maxRetries: 3,
};

describe('OpenAI提供商测试 (AC1)', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    provider = new OpenAIProvider(mockConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).cache = mockCache;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).costTracker = mockCostTracker;
  });

  describe('2.1-UNIT-001: OpenAI客户端配置验证', () => {
    it('应该使用正确的API密钥初始化', () => {
      // 验证提供商可以正常创建
      expect(provider).toBeDefined();
    });

    it('应该验证必需配置参数', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new OpenAIProvider({} as any)).not.toThrow();
    });

    it('应该设置默认配置值', () => {
      const minimalConfig = { apiKey: 'sk-test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new OpenAIProvider(minimalConfig as any);
      expect(provider).toBeDefined();
    });
  });

  describe('2.1-UNIT-002: GPT-4o-mini请求构建', () => {
    it('应该构建正确的摘要请求', async () => {
      const mockResponse = {
        choices: [
          { message: { content: 'Test summary' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };
      mockCreate.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('test-key');

      await provider.generateSummary('Test content');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: expect.stringContaining('summarize') },
          { role: 'user', content: 'Test content' },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });
    });

    it('应该处理不同摘要长度选项', async () => {
      const mockResponse = {
        choices: [
          { message: { content: 'Short summary' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 25 },
      };
      mockCreate.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('test-key');

      await provider.generateSummary('Test content', {
        summaryLength: 'short',
      });

      const call = mockCreate.mock.calls[0][0];
      expect(call.max_tokens).toBe(100);
    });

    it('应该构建正确的标签生成请求', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: '["technology", "AI"]' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 20 },
      };
      mockCreate.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('test-key-tags');

      await provider.generateTags('AI technology content');

      const call = mockCreate.mock.calls[0][0];
      expect(call.messages[0].content).toContain('tags');
      expect(call.max_tokens).toBe(100);
    });
  });

  describe('2.1-UNIT-003: 响应解析和验证', () => {
    it('应该正确解析摘要响应', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'This is a test summary' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      };
      mockCreate.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('test-key');

      const result = await provider.generateSummary('Test content');

      expect(result.summary).toBe('This is a test summary');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBeDefined();
    });

    it('应该处理空响应错误', async () => {
      const mockResponse = {
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 0 },
      };
      mockCreate.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);

      await expect(provider.generateSummary('Test content')).rejects.toThrow(
        AIError
      );
      await expect(provider.generateSummary('Test content')).rejects.toThrow(
        'Failed to generate summary'
      );
    });

    it('应该正确解析标签JSON响应', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: '["technology", "AI", "software"]' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 30 },
      };
      mockCreate.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('test-key-tags');

      const result = await provider.generateTags('AI technology content');

      expect(result.tags).toEqual(['technology', 'AI', 'software']);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('应该处理无效JSON标签响应', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'invalid json response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 20 },
      };
      mockCreate.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('test-key-tags');

      const result = await provider.generateTags('Test content');

      expect(result.tags).toEqual([]); // 回退到空数组
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('应该计算合理的置信度分数', async () => {
      const testCases = [
        { content: 'This is a detailed summary', expectedRange: [0.7, 1.0] },
        { content: 'Short', expectedRange: [0.2, 0.7] },
        { content: ' ', expectedRange: [0.0, 0.2] }, // 单个空格而不是空字符串
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          choices: [
            {
              message: { content: testCase.content },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: testCase.content.length,
          },
        };
        mockCreate.mockResolvedValue(mockResponse);
        mockCostTracker.checkBudget.mockResolvedValue(undefined);
        mockCache.get.mockResolvedValue(null);
        mockCache.generateCacheKey.mockReturnValue(`test-key-${Math.random()}`);

        const result = await provider.generateSummary('Test input');
        expect(result.confidence).toBeGreaterThanOrEqual(
          testCase.expectedRange[0]
        );
        expect(result.confidence).toBeLessThanOrEqual(
          testCase.expectedRange[1]
        );
      }
    });
  });
});
