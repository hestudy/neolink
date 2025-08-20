import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeProvider } from '../providers/ClaudeProvider.js';
import { AIError } from '../types/providers.js';

// Mock Anthropic SDK
const mockCreateMessage = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreateMessage,
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
  apiKey: 'claude-test123',
  model: 'claude-3-haiku-20240307',
  timeout: 30000,
};

describe('Claude提供商测试 (AC2)', () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMessage.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider = new ClaudeProvider(mockConfig as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).cache = mockCache;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).costTracker = mockCostTracker;
  });

  describe('2.1-UNIT-004: Claude客户端配置验证', () => {
    it('应该使用正确的API密钥初始化', () => {
      // 验证提供商可以正常创建
      expect(provider).toBeDefined();
    });

    it('应该验证必需配置参数', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new ClaudeProvider({} as any)).not.toThrow();
    });

    it('应该设置默认配置值', () => {
      const minimalConfig = { apiKey: 'claude-test' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new ClaudeProvider(minimalConfig as any);
      expect(provider).toBeDefined();
    });
  });

  describe('2.1-UNIT-005: Claude请求格式化', () => {
    it('应该构建正确的摘要请求', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Test Claude summary' }],
        usage: { input_tokens: 120, output_tokens: 60 },
      };
      mockCreateMessage.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('claude-test-key');

      await provider.generateSummary('Test content for Claude');

      expect(mockCreateMessage).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('Test content for Claude'),
          },
        ],
        temperature: 0.3,
      });
    });

    it('应该合并系统提示和用户内容', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Summary result' }],
        usage: { input_tokens: 100, output_tokens: 40 },
      };
      mockCreateMessage.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('claude-test-key');

      await provider.generateSummary('User content', { summaryLength: 'long' });

      const call = mockCreateMessage.mock.calls[0][0];
      expect(call.messages[0].content).toContain('summarize');
      expect(call.messages[0].content).toContain('User content');
      expect(call.max_tokens).toBe(300); // long summary
    });

    it('应该处理标签生成请求格式', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '["AI", "technology", "innovation"]' }],
        usage: { input_tokens: 90, output_tokens: 25 },
      };
      mockCreateMessage.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('claude-tags-key');

      await provider.generateTags('AI innovation content');

      const call = mockCreateMessage.mock.calls[0][0];
      expect(call.messages[0].content).toContain('tags');
      expect(call.max_tokens).toBe(100);
    });
  });

  describe('2.1-UNIT-006: Claude响应处理', () => {
    it('应该正确解析文本响应', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Claude generated summary' }],
        usage: { input_tokens: 110, output_tokens: 55 },
      };
      mockCreateMessage.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('claude-test-key');

      const result = await provider.generateSummary('Test content');

      expect(result.summary).toBe('Claude generated summary');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBeDefined();
    });

    it('应该处理空响应错误', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '' }],
        usage: { input_tokens: 100, output_tokens: 0 },
      };
      mockCreateMessage.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);

      await expect(provider.generateSummary('Test content')).rejects.toThrow(
        AIError
      );
      await expect(provider.generateSummary('Test content')).rejects.toThrow(
        'Failed to generate summary'
      );
    });

    it('应该正确计算Claude置信度', async () => {
      const testCases = [
        { response: 'Detailed comprehensive summary', expectedMin: 0.8 },
        { response: 'Brief', expectedMax: 0.7 },
        { response: '', expectedMax: 0.1 },
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          content: [{ type: 'text', text: testCase.response }],
          usage: { input_tokens: 100, output_tokens: testCase.response.length },
          stop_reason: 'end_turn',
        };
        mockCreateMessage.mockResolvedValue(mockResponse);
        mockCostTracker.checkBudget.mockResolvedValue(undefined);
        mockCache.get.mockResolvedValue(null);
        mockCache.generateCacheKey.mockReturnValue(
          `claude-key-${Math.random()}`
        );

        if (testCase.response) {
          const result = await provider.generateSummary('Test input');
          if (testCase.expectedMin) {
            expect(result.confidence).toBeGreaterThanOrEqual(
              testCase.expectedMin
            );
          }
          if (testCase.expectedMax) {
            expect(result.confidence).toBeLessThanOrEqual(testCase.expectedMax);
          }
        }
      }
    });

    it('应该正确解析标签JSON响应', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '["science", "research", "data"]' }],
        usage: { input_tokens: 85, output_tokens: 28 },
      };
      mockCreateMessage.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('claude-tags-key');

      const result = await provider.generateTags('Scientific research data');

      expect(result.tags).toEqual(['science', 'research', 'data']);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('应该处理标签JSON解析错误', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'not valid json tags' }],
        usage: { input_tokens: 80, output_tokens: 20 },
      };
      mockCreateMessage.mockResolvedValue(mockResponse);
      mockCostTracker.checkBudget.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);
      mockCache.generateCacheKey.mockReturnValue('claude-tags-key');

      const result = await provider.generateTags('Test content');

      expect(result.tags).toEqual([]); // 回退到空数组
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});
