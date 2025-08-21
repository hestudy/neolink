import { describe, it, expect, beforeEach } from 'vitest';
import { ContentOptimizer } from './ContentOptimizer';
import { ReadableContent } from '@neolink/shared/types/content';

describe('ContentOptimizer', () => {
  let optimizer: ContentOptimizer;

  beforeEach(() => {
    optimizer = new ContentOptimizer();
  });

  describe('optimizeForAI', () => {
    it('should return content unchanged if within token limit', async () => {
      const shortContent: ReadableContent = {
        title: 'Short Article',
        byline: 'Author',
        content: '<p>This is a short article.</p>',
        textContent: 'This is a short article.',
        excerpt: 'Short excerpt',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 25,
        structuredData: {
          headings: [],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const result = await optimizer.optimizeForAI(shortContent, 1000);

      expect(result.truncated).toBe(false);
      expect(result.content).toContain(shortContent.title);
      expect(result.content).toContain(shortContent.textContent);
      expect(result.originalLength).toBeLessThan(result.optimizedLength); // Because title was added
    });

    it('should truncate content when exceeding token limit', async () => {
      const longText = 'This is a long sentence. '.repeat(200); // ~5000 characters
      const longContent: ReadableContent = {
        title: 'Long Article',
        byline: 'Author Name',
        content: `<p>${longText}</p>`,
        textContent: longText,
        excerpt: 'Long excerpt',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: longText.length,
        structuredData: {
          headings: [
            { level: 1, text: 'Main Heading' },
            { level: 2, text: 'Sub Heading' },
          ],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const result = await optimizer.optimizeForAI(longContent, 500); // 500 tokens ≈ 2000 chars

      expect(result.truncated).toBe(true);
      expect(result.optimizedLength).toBeLessThan(result.originalLength);
      expect(result.content.length).toBeLessThanOrEqual(2000); // Approximate token limit
      expect(result.truncationRatio).toBeLessThan(1);
    });

    it('should preserve title and important elements', async () => {
      const content: ReadableContent = {
        title: 'Important Article Title',
        byline: 'Author Name',
        content:
          '<h1>Main Title</h1><p>First paragraph content.</p><p>Second paragraph content.</p>',
        textContent:
          'First paragraph content.\n\nSecond paragraph content.\n\nThird paragraph content.',
        excerpt: 'Article excerpt',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 100,
        structuredData: {
          headings: [
            { level: 1, text: 'Main Title' },
            { level: 2, text: 'Subtitle' },
          ],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const result = await optimizer.optimizeForAI(content, 50); // Very small limit

      expect(result.content).toContain('Important Article Title');
      expect(result.preservedElements.title).toBe('Important Article Title');
      expect(result.preservedElements.headings.length).toBeGreaterThan(0);
    });

    it('should handle content with multiple paragraphs intelligently', async () => {
      const paragraphs = [
        'This is the introduction paragraph that sets the context.',
        'This is the middle paragraph with detailed information.',
        'This is another middle paragraph with more details.',
        'This is the conclusion paragraph that wraps up the content.',
      ];

      const content: ReadableContent = {
        title: 'Multi-Paragraph Article',
        byline: 'Author',
        content: paragraphs.map((p) => `<p>${p}</p>`).join(''),
        textContent: paragraphs.join('\n\n'),
        excerpt: 'Multi-paragraph excerpt',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: paragraphs.join(' ').length,
        structuredData: {
          headings: [],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const result = await optimizer.optimizeForAI(content, 50); // Small limit to trigger truncation

      // Should preserve introduction and conclusion
      expect(result.content).toContain('introduction paragraph');
      expect(result.content).toContain('conclusion paragraph');
      expect(
        result.preservedElements.importantParagraphs.length
      ).toBeGreaterThan(0);
    });

    it('should handle content with headings correctly', async () => {
      const content: ReadableContent = {
        title: 'Article with Headings',
        byline: 'Author',
        content:
          '<h1>Main Heading</h1><h2>Sub Heading</h2><p>Paragraph content.</p>',
        textContent: 'Main Heading\n\nSub Heading\n\nParagraph content.',
        excerpt: 'Article with headings',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 50,
        structuredData: {
          headings: [
            { level: 1, text: 'Main Heading' },
            { level: 2, text: 'Sub Heading' },
            { level: 3, text: 'Minor Heading' },
          ],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const result = await optimizer.optimizeForAI(content, 100);

      // Should preserve important headings (H1, H2)
      expect(result.preservedElements.headings.length).toBeGreaterThan(0);
      expect(result.preservedElements.headings[0].level).toBeLessThanOrEqual(2);
    });

    it('should estimate tokens correctly', async () => {
      const text1000chars = 'a'.repeat(1000);
      const content: ReadableContent = {
        title: 'Test',
        byline: 'Author',
        content: text1000chars,
        textContent: text1000chars,
        excerpt: 'Test',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 1000,
        structuredData: { headings: [], lists: [], tables: [], images: [] },
        extractedAt: new Date(),
      };

      const result = await optimizer.optimizeForAI(content);

      // 1000 chars ≈ 250 tokens (4 chars per token)
      expect(result.originalLength).toBeCloseTo(250, 50);
    });

    it('should handle empty content gracefully', async () => {
      const emptyContent: ReadableContent = {
        title: '',
        byline: '',
        content: '',
        textContent: '',
        excerpt: '',
        siteName: '',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 0,
        structuredData: { headings: [], lists: [], tables: [], images: [] },
        extractedAt: new Date(),
      };

      const result = await optimizer.optimizeForAI(emptyContent);

      expect(result.content).toBe('');
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(0);
      expect(result.optimizedLength).toBe(0);
    });
  });

  describe('validateOptimization', () => {
    it('should validate good optimization', () => {
      const original: ReadableContent = {
        title: 'Original Title',
        byline: 'Author',
        content: '<p>Original content</p>',
        textContent: 'Original content that is long enough for validation.',
        excerpt: 'Original excerpt',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 50,
        structuredData: { headings: [], lists: [], tables: [], images: [] },
        extractedAt: new Date(),
      };

      const optimized = {
        content:
          'Original Title\n\nOriginal content that is long enough for validation.',
        truncated: false,
        originalLength: 50,
        optimizedLength: 50,
        preservedElements: {
          title: 'Original Title',
          headings: [],
          importantParagraphs: [
            'Original content that is long enough for validation.',
          ],
        },
      };

      const isValid = optimizer.validateOptimization(original, optimized);
      expect(isValid).toBe(true);
    });

    it('should reject optimization with too short content', () => {
      const original: ReadableContent = {
        title: 'Original Title',
        byline: 'Author',
        content: '<p>Original content</p>',
        textContent: 'Original content',
        excerpt: 'Original excerpt',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 16,
        structuredData: { headings: [], lists: [], tables: [], images: [] },
        extractedAt: new Date(),
      };

      const optimized = {
        content: 'Short',
        truncated: true,
        originalLength: 16,
        optimizedLength: 5,
        preservedElements: {
          title: 'Original Title',
          headings: [],
          importantParagraphs: [],
        },
      };

      const isValid = optimizer.validateOptimization(original, optimized);
      expect(isValid).toBe(false);
    });

    it('should reject optimization missing title', () => {
      const original: ReadableContent = {
        title: 'Important Title',
        byline: 'Author',
        content: '<p>Content here</p>',
        textContent: 'Content here that should be preserved properly.',
        excerpt: 'Excerpt',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 50,
        structuredData: { headings: [], lists: [], tables: [], images: [] },
        extractedAt: new Date(),
      };

      const optimized = {
        content: 'Content here that should be preserved properly.',
        truncated: true,
        originalLength: 50,
        optimizedLength: 45,
        preservedElements: {
          title: 'Important Title',
          headings: [],
          importantParagraphs: [],
        },
      };

      const isValid = optimizer.validateOptimization(original, optimized);
      expect(isValid).toBe(false); // Missing title in content
    });
  });
});
