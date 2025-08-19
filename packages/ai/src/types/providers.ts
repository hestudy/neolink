export interface SummaryOptions {
  summaryLength?: 'short' | 'medium' | 'long';
  language?: string;
  maxLength?: number;
  provider?: 'openai' | 'claude';
}

export interface SummaryResult {
  summary: string;
  confidence: number;
  language: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
}

export interface TagOptions {
  maxTags?: number;
  language?: string;
  categories?: string[];
  provider?: 'openai' | 'claude';
}

export interface TagResult {
  tags: string[];
  categories: string[];
  confidence: number;
  language: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
}

export interface AIProvider {
  generateSummary(
    content: string,
    options?: SummaryOptions
  ): Promise<SummaryResult>;
  generateTags(content: string, options?: TagOptions): Promise<TagResult>;
  isHealthy(): Promise<boolean>;
}

export interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
  model: string;
  operation: string;
  userId?: string;
}

export class AIError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class BudgetExceededError extends AIError {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class RateLimitExceededError extends AIError {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

export class ProviderUnavailableError extends AIError {
  constructor(
    message: string,
    public providerName: string
  ) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}
