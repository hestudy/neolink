import type {
  AIProvider,
  AIConfig,
  SummaryOptions,
  SummaryResult,
  TagOptions,
  TagResult,
  ProviderUnavailableError,
} from '../types';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { ClaudeProvider } from '../providers/ClaudeProvider';
import { CostTracker, MemoryCostStorage } from './CostTracker';
import { RateLimitService, MemoryRateLimitStorage } from '../utils/rateLimit';
import { HealthChecker } from './HealthChecker';
import { MemoryCacheService } from '../utils/cache';
import { SummaryFallbackService } from './SummaryFallbackService';

export class AIService {
  private providers: Map<string, AIProvider>;
  private config: AIConfig;
  private fallbackChain: string[];
  private costTracker?: CostTracker;
  private rateLimitService?: RateLimitService;
  private healthChecker: HealthChecker;
  private fallbackService: SummaryFallbackService;

  constructor(config: AIConfig) {
    this.config = config;
    this.providers = new Map();
    this.fallbackChain = ['openai', 'claude'];

    // Initialize cache service
    const cacheService = new MemoryCacheService();

    // Initialize providers based on config
    if (config.openai?.enabled) {
      this.providers.set(
        'openai',
        new OpenAIProvider(config.openai, cacheService)
      );
    }
    if (config.claude?.enabled) {
      this.providers.set(
        'claude',
        new ClaudeProvider(config.claude, cacheService)
      );
    }

    // Initialize cost tracking if enabled
    if (config.costLimits) {
      const costStorage = new MemoryCostStorage();
      this.costTracker = new CostTracker(costStorage, config.costLimits);
    }

    // Initialize rate limiting if enabled
    if (config.rateLimit) {
      const rateLimitStorage = new MemoryRateLimitStorage();
      this.rateLimitService = new RateLimitService(
        rateLimitStorage,
        config.rateLimit
      );
    }

    // Initialize health checker
    this.healthChecker = new HealthChecker(this.providers);

    // Initialize fallback service
    this.fallbackService = new SummaryFallbackService();

    if (this.providers.size === 0) {
      throw new Error('No AI providers configured');
    }
  }

  async generateSummary(
    content: string,
    options: SummaryOptions = {},
    userId?: string,
    metadata?: { title?: string; description?: string }
  ): Promise<SummaryResult> {
    const operation = 'summary';

    // Check rate limits
    if (this.rateLimitService) {
      const identifier = userId || 'anonymous';
      await this.rateLimitService.checkRateLimit(identifier, operation);
    }

    // Check budget limits
    if (this.costTracker) {
      await this.costTracker.checkBudget(operation, userId);
    }

    try {
      const provider =
        options.provider || this.config.defaultProvider || 'openai';
      const result = await this.executeWithFallback<SummaryResult>(
        'generateSummary',
        provider,
        content,
        options
      );

      // Record usage for cost tracking
      if (this.costTracker && result && result.tokensUsed) {
        const providerInstance = this.providers.get(provider);
        let cost = 0;

        if (providerInstance instanceof OpenAIProvider) {
          cost = providerInstance.calculateCost({
            prompt_tokens: result.tokensUsed.input,
            completion_tokens: result.tokensUsed.output,
          });
        } else if (providerInstance instanceof ClaudeProvider) {
          cost = providerInstance.calculateCost({
            input_tokens: result.tokensUsed.input,
            output_tokens: result.tokensUsed.output,
          });
        }

        await this.costTracker.recordUsage(
          operation,
          {
            inputTokens: result.tokensUsed.input,
            outputTokens: result.tokensUsed.output,
            cost,
            timestamp: new Date(),
            model: provider,
            operation,
          },
          userId
        );
      }

      return result;
    } catch (error) {
      // Don't use fallback for budget/rate limit errors, validation errors, or if fallback is disabled
      if (
        (error as Error).name === 'BudgetExceededError' ||
        (error as Error).name === 'RateLimitExceededError' ||
        (error as Error).message.includes('validation') ||
        !content ||
        content.trim().length === 0 ||
        options.disableFallback
      ) {
        throw error;
      }

      // If all AI providers failed due to service issues, use fallback service
      console.warn(
        'All AI providers failed for summary generation, using fallback service:',
        (error as Error).message
      );

      return await this.fallbackService.generateFallbackSummary({
        title: metadata?.title,
        description: metadata?.description,
        content,
        language: options.language,
        maxLength: this.getSummaryMaxLength(options.summaryLength),
      });
    }
  }

  /**
   * 获取摘要最大长度
   */
  private getSummaryMaxLength(summaryLength?: string): number {
    switch (summaryLength) {
      case 'short':
        return 150;
      case 'long':
        return 500;
      case 'medium':
      default:
        return 300;
    }
  }

  async generateTags(
    content: string,
    options: TagOptions = {},
    userId?: string
  ): Promise<TagResult> {
    const operation = 'tags';

    // Check rate limits
    if (this.rateLimitService) {
      const identifier = userId || 'anonymous';
      await this.rateLimitService.checkRateLimit(identifier, operation);
    }

    // Check budget limits
    if (this.costTracker) {
      await this.costTracker.checkBudget(operation, userId);
    }

    const provider =
      options.provider || this.config.defaultProvider || 'openai';
    const result = await this.executeWithFallback<TagResult>(
      'generateTags',
      provider,
      content,
      options
    );

    // Record usage for cost tracking
    if (this.costTracker && result && result.tokensUsed) {
      const providerInstance = this.providers.get(provider);
      let cost = 0;

      if (providerInstance instanceof OpenAIProvider) {
        cost = providerInstance.calculateCost({
          prompt_tokens: result.tokensUsed.input,
          completion_tokens: result.tokensUsed.output,
        });
      } else if (providerInstance instanceof ClaudeProvider) {
        cost = providerInstance.calculateCost({
          input_tokens: result.tokensUsed.input,
          output_tokens: result.tokensUsed.output,
        });
      }

      await this.costTracker.recordUsage(
        operation,
        {
          inputTokens: result.tokensUsed.input,
          outputTokens: result.tokensUsed.output,
          cost,
          timestamp: new Date(),
          model: provider,
          operation,
        },
        userId
      );
    }

    return result;
  }

  async getHealth() {
    return await this.healthChecker.getSystemHealth();
  }

  async getCostReport() {
    return this.costTracker ? await this.costTracker.getCostReport() : null;
  }

  async getBudgetStatus(userId?: string) {
    return this.costTracker
      ? await this.costTracker.getBudgetStatus(userId)
      : null;
  }

  async getRateLimitStatus(identifier: string, operation: string) {
    return this.rateLimitService
      ? await this.rateLimitService.getRateLimitStatus(identifier, operation)
      : null;
  }

  private async executeWithFallback<T>(
    method: keyof AIProvider,
    primaryProvider: string,
    ...args: unknown[]
  ): Promise<T> {
    const providers = [
      primaryProvider,
      ...this.fallbackChain.filter((p) => p !== primaryProvider),
    ];

    let lastError: Error | null = null;

    for (const providerName of providers) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        return await (provider[method] as (...args: unknown[]) => Promise<T>)(
          ...args
        );
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `AI provider ${providerName} failed:`,
          (error as Error).message
        );

        // If it's a budget error, don't try fallback
        if ((error as Error).name === 'BudgetExceededError') {
          throw error;
        }

        // If it's a rate limit error, don't try fallback
        if ((error as Error).name === 'RateLimitExceededError') {
          throw error;
        }

        // Continue to next provider for other errors
        continue;
      }
    }

    // All providers failed
    const error = new Error(
      'All AI providers failed'
    ) as ProviderUnavailableError;
    error.name = 'ProviderUnavailableError';
    error.providerName = 'all';
    if (lastError) {
      error.cause = lastError;
    }
    throw error;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getConfig(): AIConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AIConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update rate limits if they changed
    if (updates.rateLimit && this.rateLimitService) {
      this.rateLimitService.updateRules(updates.rateLimit);
    }
  }
}
