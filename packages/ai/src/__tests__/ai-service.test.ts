import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../services/AIService.js';
import { AIError, BudgetExceededError } from '../types/providers.js';

// Mock providers
const mockOpenAIProvider = {
  generateSummary: vi.fn(),
  generateTags: vi.fn(),
  generateCategories: vi.fn(),
};

const mockClaudeProvider = {
  generateSummary: vi.fn(),
  generateTags: vi.fn(),
  generateCategories: vi.fn(),
};

const mockConfig = {
  defaultProvider: 'openai' as const,
  openai: { enabled: true },
  claude: { enabled: true },
  costLimits: {
    monthlyBudget: 50,
    dailyBudget: 5,
    userBudget: 2,
  },
  rateLimit: {
    summary: { maxRequests: 100, windowMs: 3600000 },
  },
};

describe('AI服务集成测试 (多AC)', () => {
  let aiService: AIService;

  beforeEach(() => {
    vi.clearAllMocks();

    // 重置mock函数状态
    mockOpenAIProvider.generateSummary.mockReset();
    mockOpenAIProvider.generateTags.mockReset();
    mockOpenAIProvider.generateCategories.mockReset();
    mockClaudeProvider.generateSummary.mockReset();
    mockClaudeProvider.generateTags.mockReset();
    mockClaudeProvider.generateCategories.mockReset();

    aiService = new AIService(mockConfig);
    // 手动设置 mock 提供商
    (aiService as unknown as { providers: Map<string, unknown> }).providers =
      new Map([
        ['openai', mockOpenAIProvider],
        ['claude', mockClaudeProvider],
      ]);
  });

  describe('2.1-INT-001: OpenAI API调用流程(mock)', () => {
    it('应该成功调用OpenAI生成摘要', async () => {
      const expectedResult = {
        summary: 'OpenAI generated summary',
        confidence: 0.9,
        language: 'en',
        tokensUsed: { input: 100, output: 50 },
      };
      mockOpenAIProvider.generateSummary.mockResolvedValue(expectedResult);

      const result = await aiService.generateSummary('Test content', {
        provider: 'openai',
      });

      expect(result).toEqual(expectedResult);
      expect(mockOpenAIProvider.generateSummary).toHaveBeenCalledWith(
        'Test content',
        { provider: 'openai' }
      );
    });

    it('应该使用默认提供商当未指定时', async () => {
      const expectedResult = {
        summary: 'Default provider summary',
        confidence: 0.85,
        language: 'en',
        tokensUsed: { input: 120, output: 60 },
      };
      mockOpenAIProvider.generateSummary.mockResolvedValue(expectedResult);

      const result = await aiService.generateSummary('Test content');

      expect(result).toEqual(expectedResult);
      expect(mockOpenAIProvider.generateSummary).toHaveBeenCalled();
    });
  });

  describe('2.1-INT-002: OpenAI重试机制', () => {
    it('应该在临时错误时重试OpenAI调用', async () => {
      // 第一次失败，第二次失败，第三次成功（故障转移到claude）
      mockOpenAIProvider.generateSummary
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Rate limit (temporary)'));

      mockClaudeProvider.generateSummary.mockResolvedValue({
        summary: 'Success after retries',
        confidence: 0.8,
        language: 'en',
        tokensUsed: { input: 90, output: 45 },
      });

      const result = await aiService.generateSummary('Test content', {
        provider: 'openai',
      });

      expect(result.summary).toBe('Success after retries');
      expect(mockOpenAIProvider.generateSummary).toHaveBeenCalledTimes(1);
      expect(mockClaudeProvider.generateSummary).toHaveBeenCalledTimes(1);
    });

    it('应该在预算错误时不重试', async () => {
      const budgetError = new Error('Monthly budget exceeded');
      budgetError.name = 'BudgetExceededError';
      mockOpenAIProvider.generateSummary.mockRejectedValue(budgetError);

      await expect(
        aiService.generateSummary('Test content', { provider: 'openai' })
      ).rejects.toThrow('Monthly budget exceeded');

      expect(mockOpenAIProvider.generateSummary).toHaveBeenCalledTimes(1);
      expect(mockClaudeProvider.generateSummary).not.toHaveBeenCalled();
    });
  });

  describe('2.1-INT-004: OpenAI到Claude故障转移', () => {
    it('应该在OpenAI失败时降级到Claude', async () => {
      // 重置所有mock
      mockOpenAIProvider.generateSummary.mockReset();
      mockClaudeProvider.generateSummary.mockReset();

      mockOpenAIProvider.generateSummary.mockRejectedValue(
        new Error('OpenAI service unavailable')
      );
      mockClaudeProvider.generateSummary.mockResolvedValue({
        summary: 'Claude fallback summary',
        confidence: 0.75,
        language: 'en',
        tokensUsed: { input: 110, output: 55 },
      });

      const result = await aiService.generateSummary('Test content');

      expect(result.summary).toBe('Claude fallback summary');
      expect(mockOpenAIProvider.generateSummary).toHaveBeenCalled();
      expect(mockClaudeProvider.generateSummary).toHaveBeenCalled();
    });

    it('应该在所有提供商失败时抛出错误', async () => {
      mockOpenAIProvider.generateSummary.mockRejectedValue(
        new Error('OpenAI failed')
      );
      mockClaudeProvider.generateSummary.mockRejectedValue(
        new Error('Claude failed')
      );

      await expect(aiService.generateSummary('Test content')).rejects.toThrow(
        'All AI providers failed'
      );

      expect(mockOpenAIProvider.generateSummary).toHaveBeenCalled();
      expect(mockClaudeProvider.generateSummary).toHaveBeenCalled();
    });

    it('应该记录故障转移事件', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockOpenAIProvider.generateSummary.mockRejectedValue(
        new Error('OpenAI timeout')
      );
      mockClaudeProvider.generateSummary.mockResolvedValue({
        summary: 'Claude backup result',
        confidence: 0.8,
        language: 'en',
        tokensUsed: { input: 105, output: 52 },
      });

      await aiService.generateSummary('Test content');

      expect(consoleSpy).toHaveBeenCalledWith(
        'AI provider openai failed:',
        'OpenAI timeout'
      );

      consoleSpy.mockRestore();
    });

    it('应该支持指定Claude作为主提供商', async () => {
      mockClaudeProvider.generateSummary.mockResolvedValue({
        summary: 'Primary Claude result',
        confidence: 0.85,
        language: 'en',
        tokensUsed: { input: 95, output: 48 },
      });

      const result = await aiService.generateSummary('Test content', {
        provider: 'claude',
      });

      expect(result.summary).toBe('Primary Claude result');
      expect(mockClaudeProvider.generateSummary).toHaveBeenCalled();
      expect(mockOpenAIProvider.generateSummary).not.toHaveBeenCalled();
    });
  });

  describe('2.1-INT-007: 多服务错误处理流程', () => {
    it('应该正确传播预算错误而不故障转移', async () => {
      mockOpenAIProvider.generateSummary.mockRejectedValue(
        new BudgetExceededError('Daily budget exceeded')
      );

      await expect(aiService.generateSummary('Test content')).rejects.toThrow(
        BudgetExceededError
      );

      expect(mockOpenAIProvider.generateSummary).toHaveBeenCalled();
      expect(mockClaudeProvider.generateSummary).not.toHaveBeenCalled();
    });

    it('应该区分不同错误类型的处理策略', async () => {
      const errors = [
        { error: new Error('Network timeout'), shouldFallback: true },
        {
          error: new BudgetExceededError('Budget exceeded'),
          shouldFallback: false,
        },
        { error: new AIError('API error'), shouldFallback: true },
      ];

      for (const { error, shouldFallback } of errors) {
        vi.clearAllMocks();
        mockOpenAIProvider.generateSummary.mockRejectedValue(error);

        if (shouldFallback) {
          mockClaudeProvider.generateSummary.mockResolvedValue({
            summary: 'Fallback result',
            confidence: 0.7,
            language: 'en',
            tokensUsed: { input: 80, output: 40 },
          });

          const result = await aiService.generateSummary('Test');
          expect(result.summary).toBe('Fallback result');
          expect(mockClaudeProvider.generateSummary).toHaveBeenCalled();
        } else {
          await expect(aiService.generateSummary('Test')).rejects.toThrow(
            error.constructor
          );
          expect(mockClaudeProvider.generateSummary).not.toHaveBeenCalled();
        }
      }
    });
  });
});
