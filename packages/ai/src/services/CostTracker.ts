import type { CostLimits, UsageRecord, BudgetExceededError } from '../types';
import type { CostReport } from '../types/responses';

export interface CostStorage {
  getSpend(key: string): Promise<number>;
  addSpend(key: string, amount: number): Promise<void>;
  recordUsage(
    record: UsageRecord & { operation: string; userId?: string }
  ): Promise<void>;
  getUsageRecords(timeframe: string): Promise<UsageRecord[]>;
}

export class MemoryCostStorage implements CostStorage {
  private spend = new Map<string, number>();
  private usage: (UsageRecord & { operation: string; userId?: string })[] = [];

  async getSpend(key: string): Promise<number> {
    return this.spend.get(key) || 0;
  }

  async addSpend(key: string, amount: number): Promise<void> {
    const current = await this.getSpend(key);
    this.spend.set(key, current + amount);
  }

  async recordUsage(
    record: UsageRecord & { operation: string; userId?: string }
  ): Promise<void> {
    this.usage.push({ ...record, timestamp: new Date() });

    // Keep only last 1000 records to prevent memory issues
    if (this.usage.length > 1000) {
      this.usage = this.usage.slice(-1000);
    }
  }

  async getUsageRecords(_timeframe: string): Promise<UsageRecord[]> {
    // Simple filter - in a real implementation, would use proper date filtering
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days

    return this.usage
      .filter((record) => record.timestamp >= cutoff)
      .map(({ operation, userId: _userId, ...record }) => ({
        ...record,
        operation,
      }));
  }
}

export class CostTracker {
  private storage: CostStorage;
  private limits: CostLimits;

  constructor(storage: CostStorage, limits: CostLimits) {
    this.storage = storage;
    this.limits = limits;
  }

  async checkBudget(operation: string, userId?: string): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Check monthly budget
    const monthlySpend = await this.storage.getSpend(`monthly:${currentMonth}`);
    if (monthlySpend >= this.limits.monthlyBudget) {
      const error = new Error('Monthly budget exceeded') as BudgetExceededError;
      error.name = 'BudgetExceededError';
      throw error;
    }

    // Check daily budget
    const dailySpend = await this.storage.getSpend(`daily:${currentDay}`);
    if (dailySpend >= this.limits.dailyBudget) {
      const error = new Error('Daily budget exceeded') as BudgetExceededError;
      error.name = 'BudgetExceededError';
      throw error;
    }

    // Check user budget (if user ID provided)
    if (userId) {
      const userSpend = await this.storage.getSpend(
        `user:${userId}:${currentMonth}`
      );
      if (userSpend >= this.limits.userBudget) {
        const error = new Error('User budget exceeded') as BudgetExceededError;
        error.name = 'BudgetExceededError';
        throw error;
      }
    }
  }

  async recordUsage(
    operation: string,
    usage: UsageRecord,
    userId?: string
  ): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentDay = new Date().toISOString().slice(0, 10);

    // Record spending at different levels
    await this.storage.addSpend(`monthly:${currentMonth}`, usage.cost);
    await this.storage.addSpend(`daily:${currentDay}`, usage.cost);

    if (userId) {
      await this.storage.addSpend(`user:${userId}:${currentMonth}`, usage.cost);
    }

    // Record detailed usage
    await this.storage.recordUsage({
      ...usage,
      operation,
      userId,
    });
  }

  async getCurrentSpend(
    timeframe: 'daily' | 'monthly' | 'user',
    userId?: string
  ): Promise<number> {
    const now = new Date();
    let key: string;

    switch (timeframe) {
      case 'daily':
        key = `daily:${now.toISOString().slice(0, 10)}`;
        break;
      case 'monthly':
        key = `monthly:${now.toISOString().slice(0, 7)}`;
        break;
      case 'user':
        if (!userId) throw new Error('User ID required for user spending');
        key = `user:${userId}:${now.toISOString().slice(0, 7)}`;
        break;
      default:
        throw new Error(`Invalid timeframe: ${timeframe}`);
    }

    return await this.storage.getSpend(key);
  }

  async getBudgetStatus(userId?: string): Promise<{
    daily: { spent: number; limit: number; remaining: number };
    monthly: { spent: number; limit: number; remaining: number };
    user?: { spent: number; limit: number; remaining: number };
  }> {
    const dailySpent = await this.getCurrentSpend('daily');
    const monthlySpent = await this.getCurrentSpend('monthly');

    const result = {
      daily: {
        spent: dailySpent,
        limit: this.limits.dailyBudget,
        remaining: Math.max(0, this.limits.dailyBudget - dailySpent),
      },
      monthly: {
        spent: monthlySpent,
        limit: this.limits.monthlyBudget,
        remaining: Math.max(0, this.limits.monthlyBudget - monthlySpent),
      },
    };

    if (userId) {
      const userSpent = await this.getCurrentSpend('user', userId);
      return {
        ...result,
        user: {
          spent: userSpent,
          limit: this.limits.userBudget,
          remaining: Math.max(0, this.limits.userBudget - userSpent),
        },
      };
    }

    return result;
  }

  async getCostReport(): Promise<CostReport> {
    const dailySpent = await this.getCurrentSpend('daily');
    const monthlySpent = await this.getCurrentSpend('monthly');
    const records = await this.storage.getUsageRecords('month');

    // Aggregate by operation
    const breakdown = records.reduce(
      (acc, record) => {
        const existingOp = acc.find((op) => op.operation === record.operation);
        if (existingOp) {
          existingOp.cost += record.cost;
          existingOp.requests += 1;
        } else {
          acc.push({
            operation: record.operation,
            cost: record.cost,
            requests: 1,
          });
        }
        return acc;
      },
      [] as { operation: string; cost: number; requests: number }[]
    );

    return {
      totalCost: monthlySpent,
      dailyCost: dailySpent,
      monthlyCost: monthlySpent,
      breakdown,
    };
  }

  isNearBudgetLimit(_percentage = 0.8): {
    daily: boolean;
    monthly: boolean;
  } {
    return {
      daily: false, // Will be implemented when we have async getCurrentSpend
      monthly: false, // Will be implemented when we have async getCurrentSpend
    };
  }
}
