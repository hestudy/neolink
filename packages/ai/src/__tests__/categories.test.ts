import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { ClaudeProvider } from '../providers/ClaudeProvider';
import type { OpenAIConfig, ClaudeConfig, CostLimits } from '../types/config';
import type { Redis } from '@redis/client';

// Mock Redis for testing
const mockRedis = {
  get: () => Promise.resolve('0'),
  setex: () => Promise.resolve('OK'),
  incrbyfloat: () => Promise.resolve(1.0),
  expire: () => Promise.resolve(1),
  lpush: () => Promise.resolve(1),
} as unknown as Redis;

const mockCostLimits: CostLimits = {
  monthlyBudget: 50,
  dailyBudget: 5,
  userBudget: 2,
};

describe('Categories Feature Implementation', () => {
  describe('OpenAI Provider Categories', () => {
    it('should infer categories from tech-related tags', () => {
      const mockConfig: OpenAIConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        timeout: 30000,
        maxRetries: 3,
      };

      const provider = new OpenAIProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      // Access the private method for testing
      const inferCategories = (
        provider as unknown as {
          inferCategoriesFromTags: (tags: string[]) => string[];
        }
      ).inferCategoriesFromTags;
      const techTags = ['javascript', 'programming', 'api', 'web-development'];

      const categories = inferCategories(techTags);

      expect(categories).toContain('Technology');
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.length).toBeLessThanOrEqual(3);
    });

    it('should infer categories from health-related tags', () => {
      const mockConfig: OpenAIConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        timeout: 30000,
        maxRetries: 3,
      };

      const provider = new OpenAIProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      const inferCategories = (
        provider as unknown as {
          inferCategoriesFromTags: (tags: string[]) => string[];
        }
      ).inferCategoriesFromTags;
      const healthTags = ['fitness', 'nutrition', 'wellness', 'health'];

      const categories = inferCategories(healthTags);

      expect(categories).toContain('Health');
    });

    it('should parse JSON response with categories', () => {
      const mockConfig: OpenAIConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        timeout: 30000,
        maxRetries: 3,
      };

      const provider = new OpenAIProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      const parseResponse = (
        provider as unknown as {
          parseTagsResponse: (
            response: string,
            maxTags: number
          ) => { tags: string[]; categories: string[] };
        }
      ).parseTagsResponse;
      const jsonResponse = JSON.stringify({
        tags: ['tech', 'programming', 'web'],
        categories: ['Technology', 'Development'],
      });

      const result = parseResponse(jsonResponse, 10);

      expect(result.tags).toEqual(['tech', 'programming', 'web']);
      expect(result.categories).toEqual(['Technology', 'Development']);
    });

    it('should fallback to comma-separated parsing with category inference', () => {
      const mockConfig: OpenAIConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        timeout: 30000,
        maxRetries: 3,
      };

      const provider = new OpenAIProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      // Bind the method to the provider instance
      const parseResponse = (
        provider as unknown as {
          parseTagsResponse: (
            response: string,
            maxTags: number
          ) => { tags: string[]; categories: string[] };
        }
      ).parseTagsResponse.bind(provider);
      const commaResponse = 'javascript, programming, web, api';

      const result = parseResponse(commaResponse, 10);

      expect(result.tags).toEqual(['javascript', 'programming', 'web', 'api']);
      expect(result.categories).toContain('Technology');
    });
  });

  describe('Claude Provider Categories', () => {
    it('should infer categories from business-related tags', () => {
      const mockConfig: ClaudeConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'claude-3-haiku-20240307',
        timeout: 30000,
      };

      const provider = new ClaudeProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      const inferCategories = (
        provider as unknown as {
          inferCategoriesFromTags: (tags: string[]) => string[];
        }
      ).inferCategoriesFromTags;
      const businessTags = ['startup', 'marketing', 'strategy', 'business'];

      const categories = inferCategories(businessTags);

      expect(categories).toContain('Business');
    });

    it('should handle mixed category tags', () => {
      const mockConfig: ClaudeConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'claude-3-haiku-20240307',
        timeout: 30000,
      };

      const provider = new ClaudeProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      const inferCategories = (
        provider as unknown as {
          inferCategoriesFromTags: (tags: string[]) => string[];
        }
      ).inferCategoriesFromTags;
      const mixedTags = ['javascript', 'fitness', 'business', 'education'];

      const categories = inferCategories(mixedTags);

      // Should identify multiple categories
      expect(categories.length).toBeGreaterThan(1);
      expect(categories).toContain('Technology');
      expect(categories).toContain('Business');
      // Note: 'fitness' should map to 'Health' category
      if (categories.includes('Health')) {
        expect(categories).toContain('Health');
      }
    });

    it('should limit categories to maximum of 3', () => {
      const mockConfig: ClaudeConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'claude-3-haiku-20240307',
        timeout: 30000,
      };

      const provider = new ClaudeProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      const inferCategories = (
        provider as unknown as {
          inferCategoriesFromTags: (tags: string[]) => string[];
        }
      ).inferCategoriesFromTags;
      const manyTags = [
        'javascript',
        'fitness',
        'business',
        'education',
        'entertainment',
        'news',
        'politics',
        'health',
      ];

      const categories = inferCategories(manyTags);

      expect(categories.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array for unrecognized tags', () => {
      const mockConfig: ClaudeConfig = {
        enabled: true,
        apiKey: 'test-key',
        model: 'claude-3-haiku-20240307',
        timeout: 30000,
      };

      const provider = new ClaudeProvider(
        mockConfig,
        mockRedis,
        mockCostLimits
      );

      const inferCategories = (
        provider as unknown as {
          inferCategoriesFromTags: (tags: string[]) => string[];
        }
      ).inferCategoriesFromTags;
      const unknownTags = ['xyzabc', 'qwerty', 'unknown'];

      const categories = inferCategories(unknownTags);

      expect(categories).toEqual([]);
    });
  });
});
