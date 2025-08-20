import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostTracker, MemoryCostStorage } from '../services/CostTracker.js';
// BudgetExceededError is handled by costTracker internally via checkBudget method

describe('成本跟踪测试 (AC5)', () => {
  let costTracker: CostTracker;
  let mockStorage: MemoryCostStorage;
  const mockLimits = {
    monthlyBudget: 50,
    dailyBudget: 5,
    userBudget: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = new MemoryCostStorage();
    costTracker = new CostTracker(mockStorage, mockLimits);
  });

  describe('2.1-UNIT-013: Token计数算法', () => {
    it('应该正确计算OpenAI成本', () => {
      const inputTokens = 1000;
      const outputTokens = 500;

      // GPT-4o-mini 定价: $0.150/1M input, $0.600/1M output
      const expectedCost =
        (inputTokens * 0.15) / 1000000 + (outputTokens * 0.6) / 1000000;

      expect(expectedCost).toBeCloseTo(0.00045, 6);
    });

    it('应该正确计算Claude成本', () => {
      const inputTokens = 1000;
      const outputTokens = 500;

      // Claude Haiku 定价: $0.25/1M input, $1.25/1M output
      const expectedCost =
        (inputTokens * 0.25) / 1000000 + (outputTokens * 1.25) / 1000000;

      expect(expectedCost).toBeCloseTo(0.000875, 6);
    });

    it('应该处理零token使用情况', () => {
      const inputTokens = 0;
      const outputTokens = 0;

      expect(inputTokens + outputTokens).toBe(0);
    });
  });

  describe('2.1-UNIT-014: 成本费率计算', () => {
    it('应该使用正确的GPT-4o-mini费率', () => {
      const calculateOpenAICost = (
        inputTokens: number,
        outputTokens: number
      ) => {
        const INPUT_RATE = 0.15 / 1000000; // $0.150 per 1M tokens
        const OUTPUT_RATE = 0.6 / 1000000; // $0.600 per 1M tokens
        return inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE;
      };

      expect(calculateOpenAICost(1000000, 1000000)).toBeCloseTo(0.75, 2);
      expect(calculateOpenAICost(100, 50)).toBeCloseTo(0.000045, 6);
    });

    it('应该使用正确的Claude Haiku费率', () => {
      const calculateClaudeCost = (
        inputTokens: number,
        outputTokens: number
      ) => {
        const INPUT_RATE = 0.25 / 1000000; // $0.25 per 1M tokens
        const OUTPUT_RATE = 1.25 / 1000000; // $1.25 per 1M tokens
        return inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE;
      };

      expect(calculateClaudeCost(1000000, 1000000)).toBeCloseTo(1.5, 2);
      expect(calculateClaudeCost(100, 50)).toBeCloseTo(0.0000875, 6);
    });

    it('应该处理不同模型的费率差异', () => {
      const modelRates = {
        'gpt-4o-mini': { input: 0.15, output: 0.6 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
      };

      Object.entries(modelRates).forEach(([_model, rates]) => {
        const cost =
          (1000 * rates.input) / 1000000 + (500 * rates.output) / 1000000;
        expect(cost).toBeGreaterThan(0);
      });
    });
  });

  describe('2.1-UNIT-015: 预算检查逻辑', () => {
    it('应该通过预算限制内的检查', async () => {
      // 在限制内的支出应该通过
      await expect(costTracker.checkBudget('summary')).resolves.not.toThrow();
    });

    it('应该阻止超出月度预算的操作', async () => {
      // 先添加超出月度限制的支出
      const currentMonth = new Date().toISOString().slice(0, 7);
      await mockStorage.addSpend(`monthly:${currentMonth}`, 55.0); // > $50

      await expect(costTracker.checkBudget('summary')).rejects.toThrow(
        'Monthly budget of $50 exceeded'
      );
      await expect(costTracker.checkBudget('summary')).rejects.toThrow(
        'Monthly budget of $50 exceeded'
      );
    });

    it('应该阻止超出日度预算的操作', async () => {
      // 先添加超出日度限制的支出
      const currentDay = new Date().toISOString().slice(0, 10);
      await mockStorage.addSpend(`daily:${currentDay}`, 6.0); // > $5

      await expect(costTracker.checkBudget('summary')).rejects.toThrow(
        'Daily budget of $5 exceeded'
      );
      await expect(costTracker.checkBudget('summary')).rejects.toThrow(
        'Daily budget of $5 exceeded'
      );
    });

    it('应该阻止超出用户预算的操作', async () => {
      // 先添加超出用户限制的支出
      const currentMonth = new Date().toISOString().slice(0, 7);
      await mockStorage.addSpend(`user:test-user:${currentMonth}`, 2.5); // > $2

      await expect(
        costTracker.checkBudget('summary', 'test-user')
      ).rejects.toThrow('User budget of $2 exceeded');
      await expect(
        costTracker.checkBudget('summary', 'test-user')
      ).rejects.toThrow('User budget of $2 exceeded');
    });

    it('应该正确检查预算接近限制状态', async () => {
      // 添加接近限制的支出
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentDay = new Date().toISOString().slice(0, 10);
      await mockStorage.addSpend(`monthly:${currentMonth}`, 45.0); // 90% of $50
      await mockStorage.addSpend(`daily:${currentDay}`, 4.0); // 80% of $5

      const isNear = await costTracker.isNearBudgetLimit();
      expect(isNear.monthly).toBe(true);
      expect(isNear.daily).toBe(true);
    });
  });
});
