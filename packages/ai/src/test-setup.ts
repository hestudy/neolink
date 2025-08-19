import { vi } from 'vitest';

// Export mock classes to be used in tests
export class MockAIError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class MockBudgetExceededError extends MockAIError {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class MockRateLimitExceededError extends MockAIError {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

// Mock global fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock environment variables for tests
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.CLAUDE_API_KEY = 'test-claude-key';
process.env.AI_DEFAULT_PROVIDER = 'openai';
process.env.AI_MONTHLY_BUDGET = '50';
process.env.AI_DAILY_BUDGET = '5';
process.env.AI_USER_BUDGET = '2';

// Mock Redis client
vi.mock('@redis/client', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    get: vi.fn(),
    setex: vi.fn(),
    incrbyfloat: vi.fn(),
    expire: vi.fn(),
    lpush: vi.fn(),
    zadd: vi.fn(),
    zcard: vi.fn(),
    zremrangebyscore: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
  })),
}));

// Mock OpenAI SDK
vi.mock('openai', () => {
  const mockChatCompletion = {
    create: vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Mocked OpenAI response',
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    }),
  };

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: mockChatCompletion,
    },
  }));

  return {
    OpenAI: MockOpenAI,
  };
});

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockMessages = {
    create: vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Mocked Claude response',
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    }),
  };

  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: mockMessages,
  }));

  return {
    Anthropic: MockAnthropic,
  };
});

// Mock crypto for consistent hashing in tests
vi.mock('crypto', () => ({
  createHash: vi.fn().mockImplementation((_algorithm: string) => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mocked-hash-value'),
  })),
}));
