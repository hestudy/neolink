import { Anthropic } from '@anthropic-ai/sdk';
import type { Message, TextBlock } from '@anthropic-ai/sdk/resources';
import type {
  AIProvider,
  SummaryOptions,
  SummaryResult,
  TagOptions,
  TagResult,
  ClaudeConfig,
} from '../types';
import { AIError } from '../types/providers';
import { CacheService, MemoryCacheService } from '../utils/cache';
import { calculateClaudeCost } from '../utils/tokenCounter';
import { SummaryPrompts } from '../prompts/SummaryPrompts';
import { SummaryQualityValidator } from '../services/SummaryQualityValidator';

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private config: ClaudeConfig;
  private cache: CacheService;
  private summaryPrompts: SummaryPrompts;
  private qualityValidator: SummaryQualityValidator;

  constructor(config: ClaudeConfig, cache?: CacheService) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout,
    });
    this.cache = cache || new MemoryCacheService();
    this.summaryPrompts = new SummaryPrompts();
    this.qualityValidator = new SummaryQualityValidator();
  }

  async generateSummary(
    content: string,
    options: SummaryOptions = {}
  ): Promise<SummaryResult> {
    // Input validation
    if (!content?.trim()) {
      throw new AIError('Content cannot be empty for summary generation');
    }

    if (content.length > 100000) {
      throw new AIError(
        'Content too large for summary generation (max 100,000 characters)'
      );
    }

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

      // Determine token limits
      const maxTokens = this.getMaxTokensForSummary(options.summaryLength);

      // Make API call
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: `${this.summaryPrompts.getSummarySystemPrompt(options)}\n\nContent to summarize:\n\n${processedContent}`,
          },
        ],
        temperature: 0.3,
      });

      const summary = (response.content[0] as TextBlock)?.text?.trim();
      if (!summary) {
        throw new AIError('Failed to generate summary');
      }

      // Calculate confidence
      const confidence = this.calculateConfidence(response);

      // Detect language
      const language = await this.detectLanguage(summary);

      const preliminaryResult: SummaryResult = {
        summary,
        confidence,
        language,
        tokensUsed: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
      };

      // Validate summary quality
      const qualityValidation = await this.qualityValidator.validate(
        content,
        preliminaryResult,
        options
      );

      // Use adjusted confidence from quality validation
      const result: SummaryResult = {
        ...preliminaryResult,
        confidence: qualityValidation.adjustedConfidence,
      };

      // Cache the result
      await this.cache.set(cacheKey, result, { ttl: 7 * 24 * 3600 }); // 7 days

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AIError') {
        throw error;
      }
      throw new AIError(
        `Claude API error: ${(error as Error).message}`,
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

      // Make API call
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `${this.getTagsSystemPrompt(options)}\n\nContent to tag:\n\n${processedContent}`,
          },
        ],
        temperature: 0.3,
      });

      const tagsText = (response.content[0] as TextBlock)?.text?.trim();
      if (!tagsText) {
        throw new AIError(
          'Failed to generate tags with Claude: Empty response'
        );
      }

      // Parse tags from response
      const maxTags = options.maxTags || 10;
      const { tags, categories } = this.parseTagsResponse(tagsText, maxTags);

      // Calculate confidence, adjust for invalid tags
      let confidence = this.calculateConfidence(response);
      if (tags.length === 0) {
        confidence = Math.min(confidence * 0.3, 0.4); // Significantly lower for invalid responses
      }

      const language = await this.detectLanguage(tagsText);

      const result: TagResult = {
        tags,
        categories,
        confidence,
        language,
        tokensUsed: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
      };

      // Cache the result
      await this.cache.set(cacheKey, result, { ttl: 7 * 24 * 3600 });

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AIError') {
        throw error;
      }
      throw new AIError(
        `Claude API error: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Health check' }],
      });
      return !!(response.content[0] as TextBlock)?.text;
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

  private calculateConfidence(response: Message): number {
    // Basic confidence calculation for Claude response
    const textBlock = response.content?.[0] as TextBlock;
    if (!textBlock?.text) {
      return 0;
    }

    const content = textBlock.text;
    const contentLength = content.length;

    // Calculate confidence based on content quality and completion status
    let baseConfidence = 0.5;

    if (response.stop_reason === 'end_turn') {
      baseConfidence = 0.9;
    } else if (response.stop_reason === 'max_tokens') {
      baseConfidence = 0.7;
    }

    // Adjust confidence based on content length and quality
    if (contentLength > 50) {
      baseConfidence = Math.min(baseConfidence + 0.1, 1.0);
    } else if (contentLength < 10) {
      baseConfidence = Math.max(baseConfidence - 0.4, 0.0);
    }

    return Math.round(baseConfidence * 100) / 100; // Round to 2 decimal places
  }

  private async detectLanguage(text: string): Promise<string> {
    // Simple language detection - same as OpenAI provider
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
    try {
      // First try to parse as JSON (structured response)
      const parsed = JSON.parse(tagsText);

      // Handle direct array format: ["tag1", "tag2", ...]
      if (Array.isArray(parsed)) {
        const tags = parsed
          .slice(0, maxTags)
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0);
        const categories = this.inferCategoriesFromTags(tags);
        return { tags, categories };
      }

      // Handle object format: {tags: [...], categories: [...]}
      if (parsed.tags && Array.isArray(parsed.tags)) {
        const tags = parsed.tags
          .slice(0, maxTags)
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0);

        const categories =
          parsed.categories && Array.isArray(parsed.categories)
            ? parsed.categories
                .map((cat: string) => cat.trim())
                .filter((cat: string) => cat.length > 0)
            : this.inferCategoriesFromTags(tags);

        return { tags, categories };
      }
    } catch {
      // Fall back to comma-separated parsing
    }

    // Parse comma-separated tags (fallback)
    // Check if response looks like valid tags
    if (
      (tagsText.includes(' ') && !tagsText.includes(',')) ||
      tagsText.toLowerCase().includes('json') ||
      tagsText.toLowerCase().includes('valid') ||
      tagsText.length > 100
    ) {
      // Likely not tags, return empty
      return { tags: [], categories: [] };
    }

    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0 && tag.length < 30) // Reasonable tag length
      .slice(0, maxTags);

    // Infer categories from tags
    const categories = this.inferCategoriesFromTags(tags);

    return { tags, categories };
  }

  private inferCategoriesFromTags(tags: string[]): string[] {
    const categoryMap = new Map<string, string[]>();

    // Technology categories
    categoryMap.set('Technology', [
      'tech',
      'technology',
      'programming',
      'coding',
      'development',
      'software',
      'hardware',
      'computer',
      'ai',
      'ml',
      'machine-learning',
      'data-science',
      'cloud',
      'devops',
      'javascript',
      'typescript',
      'python',
      'java',
      'react',
      'node',
      'api',
      'database',
      'frontend',
      'backend',
      'mobile',
      'web',
      'app',
      'framework',
      'library',
    ]);

    // Business categories
    categoryMap.set('Business', [
      'business',
      'startup',
      'entrepreneur',
      'marketing',
      'sales',
      'finance',
      'strategy',
      'management',
      'leadership',
      'productivity',
      'workflow',
      'process',
      'automation',
      'analytics',
      'growth',
      'revenue',
      'customer',
      'market',
      'competition',
      'investment',
    ]);

    // Education categories
    categoryMap.set('Education', [
      'education',
      'learning',
      'tutorial',
      'guide',
      'course',
      'training',
      'teaching',
      'study',
      'academic',
      'research',
      'knowledge',
      'skill',
      'certification',
      'university',
      'college',
      'school',
      'lesson',
      'workshop',
      'seminar',
    ]);

    // Health categories
    categoryMap.set('Health', [
      'health',
      'medical',
      'fitness',
      'wellness',
      'healthcare',
      'nutrition',
      'diet',
      'exercise',
      'mental-health',
      'therapy',
      'medicine',
      'doctor',
      'hospital',
      'treatment',
      'prevention',
      'recovery',
      'lifestyle',
    ]);

    // Entertainment categories
    categoryMap.set('Entertainment', [
      'entertainment',
      'media',
      'movie',
      'film',
      'tv',
      'show',
      'music',
      'game',
      'gaming',
      'sport',
      'sports',
      'art',
      'design',
      'creative',
      'culture',
      'hobby',
      'fun',
      'leisure',
      'travel',
      'photography',
      'video',
    ]);

    // News categories
    categoryMap.set('News', [
      'news',
      'politics',
      'government',
      'policy',
      'election',
      'world',
      'international',
      'economy',
      'financial',
      'society',
      'social',
      'current-events',
      'breaking',
      'update',
      'announcement',
      'report',
    ]);

    const matchedCategories = new Set<string>();
    const lowerTags = tags.map((tag) => tag.toLowerCase());

    // Find matching categories
    for (const [category, keywords] of categoryMap) {
      for (const tag of lowerTags) {
        if (
          keywords.some(
            (keyword) => tag.includes(keyword) || keyword.includes(tag)
          )
        ) {
          matchedCategories.add(category);
          break;
        }
      }
    }

    return Array.from(matchedCategories).slice(0, 3); // Limit to 3 categories
  }

  calculateCost(usage: {
    input_tokens?: number;
    output_tokens?: number;
  }): number {
    return calculateClaudeCost(usage, this.config.model);
  }
}
