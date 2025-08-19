export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function calculateOpenAICost(
  usage: { prompt_tokens?: number; completion_tokens?: number },
  model = 'gpt-4o-mini'
): number {
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;

  const pricing = {
    'gpt-4o-mini': {
      input: 0.00015 / 1000, // $0.15 per 1K input tokens
      output: 0.0006 / 1000, // $0.60 per 1K output tokens
    },
    'gpt-4o': {
      input: 0.0025 / 1000,
      output: 0.01 / 1000,
    },
  };

  const modelPricing =
    pricing[model as keyof typeof pricing] || pricing['gpt-4o-mini'];
  return inputTokens * modelPricing.input + outputTokens * modelPricing.output;
}

export function calculateClaudeCost(
  usage: { input_tokens?: number; output_tokens?: number },
  model = 'claude-3-haiku-20240307'
): number {
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;

  const pricing = {
    'claude-3-haiku-20240307': {
      input: 0.00025 / 1000, // $0.25 per 1K input tokens
      output: 0.00125 / 1000, // $1.25 per 1K output tokens
    },
    'claude-3-sonnet-20240229': {
      input: 0.003 / 1000,
      output: 0.015 / 1000,
    },
  };

  const modelPricing =
    pricing[model as keyof typeof pricing] ||
    pricing['claude-3-haiku-20240307'];
  return inputTokens * modelPricing.input + outputTokens * modelPricing.output;
}
