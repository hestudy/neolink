import type { AIConfig } from '../types/config';

export function loadAIConfig(): AIConfig {
  const config: AIConfig = {
    defaultProvider:
      (process.env.AI_DEFAULT_PROVIDER as 'openai' | 'claude') || 'openai',

    openai: process.env.OPENAI_API_KEY
      ? {
          enabled: process.env.OPENAI_ENABLED !== 'false',
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
          maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
        }
      : undefined,

    claude: process.env.CLAUDE_API_KEY
      ? {
          enabled: process.env.CLAUDE_ENABLED !== 'false',
          apiKey: process.env.CLAUDE_API_KEY,
          model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
          timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000'),
        }
      : undefined,

    costLimits: {
      monthlyBudget: parseFloat(process.env.AI_MONTHLY_BUDGET || '50'),
      dailyBudget: parseFloat(process.env.AI_DAILY_BUDGET || '5'),
      userBudget: parseFloat(process.env.AI_USER_BUDGET || '2'),
    },

    rateLimit: {
      summary: {
        maxRequests: parseInt(process.env.AI_SUMMARY_RATE_LIMIT || '100'),
        windowMs: parseInt(process.env.AI_SUMMARY_WINDOW_MS || '3600000'), // 1 hour
      },
      tags: {
        maxRequests: parseInt(process.env.AI_TAGS_RATE_LIMIT || '200'),
        windowMs: parseInt(process.env.AI_TAGS_WINDOW_MS || '3600000'),
      },
    },

    redis: process.env.REDIS_URL
      ? {
          url: process.env.REDIS_URL,
        }
      : undefined,
  };

  // Validate configuration
  validateAIConfig(config);

  return config;
}

export function validateAIConfig(config: AIConfig): void {
  if (!config.openai?.enabled && !config.claude?.enabled) {
    throw new Error('At least one AI provider must be enabled');
  }

  if (config.openai?.enabled && !config.openai.apiKey) {
    throw new Error('OpenAI API key is required when OpenAI is enabled');
  }

  if (config.claude?.enabled && !config.claude.apiKey) {
    throw new Error('Claude API key is required when Claude is enabled');
  }

  // Validate cost limits
  if (config.costLimits.monthlyBudget <= 0) {
    throw new Error('Monthly budget must be positive');
  }

  if (config.costLimits.dailyBudget <= 0) {
    throw new Error('Daily budget must be positive');
  }

  if (config.costLimits.userBudget <= 0) {
    throw new Error('User budget must be positive');
  }

  // Validate rate limits
  Object.entries(config.rateLimit).forEach(([operation, rule]) => {
    if (rule.maxRequests <= 0) {
      throw new Error(
        `Rate limit max requests for ${operation} must be positive`
      );
    }
    if (rule.windowMs <= 0) {
      throw new Error(`Rate limit window for ${operation} must be positive`);
    }
  });
}

export function updateAIConfig(updates: Partial<AIConfig>): AIConfig {
  const currentConfig = loadAIConfig();
  const newConfig = { ...currentConfig, ...updates };
  validateAIConfig(newConfig);
  return newConfig;
}

export function isProviderEnabled(
  config: AIConfig,
  provider: 'openai' | 'claude'
): boolean {
  return config[provider]?.enabled === true;
}

export function getEnabledProviders(config: AIConfig): ('openai' | 'claude')[] {
  const providers: ('openai' | 'claude')[] = [];
  if (isProviderEnabled(config, 'openai')) {
    providers.push('openai');
  }
  if (isProviderEnabled(config, 'claude')) {
    providers.push('claude');
  }
  return providers;
}
