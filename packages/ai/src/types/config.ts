export interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

export interface CostLimits {
  monthlyBudget: number;
  dailyBudget: number;
  userBudget: number;
}

export interface OpenAIConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  timeout: number;
  maxRetries: number;
}

export interface ClaudeConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  timeout: number;
}

export interface AIConfig {
  defaultProvider: 'openai' | 'claude';
  openai?: OpenAIConfig;
  claude?: ClaudeConfig;
  costLimits: CostLimits;
  rateLimit: Record<string, RateLimitRule>;
  redis?: {
    url: string;
  };
}
