import { OpenAI } from 'openai';
import type { ChatCompletion } from 'openai/resources';
import type {
  AIProvider,
  SummaryOptions,
  SummaryResult,
  TagOptions,
  TagResult,
  OpenAIConfig,
} from '../types';
import { AIError } from '../types';
import { CacheService, MemoryCacheService } from '../utils/cache';
import { calculateOpenAICost } from '../utils/tokenCounter';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: OpenAIConfig;
  private cache: CacheService;

  constructor(config: OpenAIConfig, cache?: CacheService) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
    this.cache = cache || new MemoryCacheService();
  }

  async generateSummary(
    content: string,
    options: SummaryOptions = {}
  ): Promise<SummaryResult> {
    try {
      // Check cache first
      const cacheKey = this.cache.generateCacheKey('summary', content, options);
      const cached = await this.cache.get<SummaryResult>(cacheKey);
      if (cached) {
        return cached;
      }

      // Prepare content with length limit
      const maxLength = options.maxLength || 4000;
      const processedContent = this.preprocessContent(content, maxLength);

      // Determine token limits based on summary length
      const maxTokens = this.getMaxTokensForSummary(options.summaryLength);

      // Make API call
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getSummarySystemPrompt(options),
          },
          {
            role: 'user',
            content: processedContent,
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      });

      const summary = response.choices[0]?.message?.content?.trim();
      if (!summary) {
        throw new AIError('Failed to generate summary: Empty response');
      }

      // Calculate confidence based on response quality
      const confidence = this.calculateConfidence(response);

      // Detect language
      const language = await this.detectLanguage(summary);

      const result: SummaryResult = {
        summary,
        confidence,
        language,
        tokensUsed: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
        },
      };

      // Cache the result
      await this.cache.set(cacheKey, result, { ttl: 7 * 24 * 3600 }); // 7 days

      return result;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        `OpenAI API error: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async generateTags(
    content: string,
    options: TagOptions = {}
  ): Promise<TagResult> {
    try {
      // Check cache first
      const cacheKey = this.cache.generateCacheKey('tags', content, options);
      const cached = await this.cache.get<TagResult>(cacheKey);
      if (cached) {
        return cached;
      }

      // Prepare content
      const processedContent = this.preprocessContent(content, 4000);
      const maxTags = options.maxTags || 10;

      // Make API call
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: this.getTagsSystemPrompt(options),
          },
          {
            role: 'user',
            content: `Content to tag:\n\n${processedContent}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const tagsText = response.choices[0]?.message?.content?.trim();
      if (!tagsText) {
        throw new AIError('Failed to generate tags: Empty response');
      }

      // Parse tags from response
      const { tags, categories } = this.parseTagsResponse(tagsText, maxTags);

      const confidence = this.calculateConfidence(response);
      const language = await this.detectLanguage(tagsText);

      const result: TagResult = {
        tags,
        categories,
        confidence,
        language,
        tokensUsed: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
        },
      };

      // Cache the result
      await this.cache.set(cacheKey, result, { ttl: 7 * 24 * 3600 });

      return result;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        `OpenAI API error: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 5,
      });
      return !!response.choices[0]?.message?.content;
    } catch {
      return false;
    }
  }

  private preprocessContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Truncate content intelligently - prefer to cut at sentence boundaries
    const truncated = content.slice(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');

    const cutPoint = Math.max(lastSentence, lastNewline);
    return cutPoint > maxLength * 0.8
      ? truncated.slice(0, cutPoint + 1)
      : truncated;
  }

  private getSummarySystemPrompt(options: SummaryOptions): string {
    const language = options.language || 'English';
    const length = options.summaryLength || 'medium';

    return `You are an expert content summarizer. Create a ${length} summary of the provided content in ${language}. 
Focus on the main points, key insights, and essential information. 
Be concise, accurate, and maintain the original tone when possible.`;
  }

  private getTagsSystemPrompt(options: TagOptions): string {
    const language = options.language || 'English';
    const maxTags = options.maxTags || 10;
    const categories = options.categories?.length
      ? `Focus on these categories: ${options.categories.join(', ')}`
      : '';

    return `You are an expert content tagger. Generate up to ${maxTags} relevant tags for the provided content in ${language}.
${categories}
Return tags as a comma-separated list. Focus on key topics, themes, and concepts.`;
  }

  private getMaxTokensForSummary(length?: string): number {
    switch (length) {
      case 'short':
        return 100;
      case 'long':
        return 300;
      case 'medium':
      default:
        return 200;
    }
  }

  private calculateConfidence(response: ChatCompletion): number {
    // Basic confidence calculation based on response completeness
    const choice = response.choices[0];
    if (!choice?.message?.content) return 0;

    if (choice.finish_reason === 'stop') return 0.9;
    if (choice.finish_reason === 'length') return 0.7;
    return 0.5;
  }

  private async detectLanguage(text: string): Promise<string> {
    // Simple language detection - could be enhanced with a proper library
    const chinesePattern = /[\u4e00-\u9fff]/;
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
    const koreanPattern = /[\uac00-\ud7af]/;

    if (chinesePattern.test(text)) return 'zh';
    if (japanesePattern.test(text)) return 'ja';
    if (koreanPattern.test(text)) return 'ko';
    return 'en';
  }

  private parseTagsResponse(
    tagsText: string,
    maxTags: number
  ): { tags: string[]; categories: string[] } {
    // Parse comma-separated tags
    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, maxTags);

    // Extract categories (simplified - just return empty for now)
    const categories: string[] = [];

    return { tags, categories };
  }

  calculateCost(usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
  }): number {
    return calculateOpenAICost(usage, this.config.model);
  }
}
