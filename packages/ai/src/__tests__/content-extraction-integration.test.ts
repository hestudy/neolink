import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ContentExtractionService } from '../services/ContentExtractionService';
import { ReadabilityService } from '../services/ReadabilityService';
import { LanguageDetector } from '../utils/LanguageDetector';
import { ContentOptimizer } from '../utils/ContentOptimizer';

describe('Content Extraction Integration Tests', () => {
  let contentService: ContentExtractionService;
  let readabilityService: ReadabilityService;
  let languageDetector: LanguageDetector;
  let contentOptimizer: ContentOptimizer;

  beforeAll(() => {
    contentService = new ContentExtractionService();
    readabilityService = new ReadabilityService();
    languageDetector = new LanguageDetector();
    contentOptimizer = new ContentOptimizer();
  });

  afterAll(async () => {
    await contentService.close();
  });

  describe('Service Initialization', () => {
    it('should initialize all services without errors', () => {
      expect(contentService).toBeDefined();
      expect(readabilityService).toBeDefined();
      expect(languageDetector).toBeDefined();
      expect(contentOptimizer).toBeDefined();
    });

    it('should have content service ready for use', async () => {
      const isReady = await contentService.isReady();
      expect(isReady).toBe(true);
    });
  });

  describe('ReadabilityService Integration', () => {
    it('should extract content from well-formed HTML', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Integration Test Article</title>
            <meta name="description" content="A test article for integration testing">
            <meta name="author" content="Test Author">
          </head>
          <body>
            <article>
              <h1>Main Article Title</h1>
              <p class="byline">By Integration Test Author</p>
              <p>This is the first paragraph of our integration test article. It contains enough content to be meaningful.</p>
              <h2>Subsection Title</h2>
              <p>This is a second paragraph that provides additional content for testing purposes.</p>
              <ul>
                <li>First list item</li>
                <li>Second list item</li>
                <li>Third list item</li>
              </ul>
              <p>This is the concluding paragraph of our test article.</p>
            </article>
          </body>
        </html>
      `;

      const result = await readabilityService.extractArticleContent(
        mockHtml,
        'https://example.com/test-article'
      );

      expect(result).toBeDefined();
      expect(result.title).toBeTruthy();
      expect(result.textContent).toBeTruthy();
      expect(result.textContent.length).toBeGreaterThan(50);
      expect(result.language).toBeDefined();
      expect(result.structuredData).toBeDefined();
      expect(result.structuredData.headings.length).toBeGreaterThan(0);
    });

    it('should handle content optimization correctly', async () => {
      const longContent = {
        title: 'Very Long Article',
        byline: 'Test Author',
        content: '<p>' + 'Long sentence with many words. '.repeat(100) + '</p>',
        textContent: 'Long sentence with many words. '.repeat(100),
        excerpt: 'A very long article for testing',
        siteName: 'Test Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 2800,
        structuredData: {
          headings: [{ level: 1, text: 'Main Title' }],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const optimized = await contentOptimizer.optimizeForAI(longContent, 500);

      expect(optimized).toBeDefined();
      expect(optimized.truncated).toBe(true);
      expect(optimized.optimizedLength).toBeLessThan(optimized.originalLength);
      expect(optimized.content).toContain(longContent.title);
    });
  });

  describe('Language Detection Integration', () => {
    it('should detect English content correctly', async () => {
      const englishText =
        'This is a comprehensive English text that should be detected accurately by our language detection system. It contains multiple sentences and sufficient content for reliable detection.';

      const result = await languageDetector.detectLanguage(englishText);

      expect(result).toBeDefined();
      expect(result.code).toBeTruthy();
      expect(result.name).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle mixed language content', async () => {
      const mixedText = `
        This is English text for testing purposes.
        这是中文测试文本。
        Esto es texto en español para pruebas.
      `;

      const results = await languageDetector.detectMultipleLanguages(mixedText);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeLessThanOrEqual(3);

      // Results should be sorted by confidence
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeGreaterThanOrEqual(
          results[i].confidence
        );
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle malformed HTML', async () => {
      const malformedHtml =
        '<html><body><p>Unclosed paragraph<div>Mixed tags</body>';

      // Should not throw but return a meaningful result
      const result = await readabilityService.extractArticleContent(
        malformedHtml,
        'https://example.com/malformed'
      );

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.textContent).toBeDefined();
    });

    it('should handle empty content gracefully', async () => {
      const emptyHtml =
        '<html><head><title></title></head><body></body></html>';

      const result = await readabilityService.extractArticleContent(
        emptyHtml,
        'https://example.com/empty'
      );

      expect(result).toBeDefined();
      expect(result.textContent).toBeDefined();
    });
  });

  describe('Content Quality Validation', () => {
    it('should validate content quality correctly', async () => {
      const goodContent = {
        title: 'Quality Article',
        byline: 'Good Author',
        content: '<p>High quality content with substantial information.</p>',
        textContent:
          'High quality content with substantial information that meets minimum length requirements.',
        excerpt: 'Quality excerpt',
        siteName: 'Quality Site',
        language: { code: 'en', name: 'English', confidence: 0.9 },
        length: 80,
        structuredData: {
          headings: [{ level: 1, text: 'Main Title' }],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const optimized = await contentOptimizer.optimizeForAI(goodContent);
      const isValid = contentOptimizer.validateOptimization(
        goodContent,
        optimized
      );

      expect(isValid).toBe(true);
    });

    it('should reject poor quality content', async () => {
      const poorContent = {
        title: '',
        byline: '',
        content: '<p>Bad</p>',
        textContent: 'Bad',
        excerpt: '',
        siteName: '',
        language: { code: 'en', name: 'English', confidence: 0.1 },
        length: 3,
        structuredData: {
          headings: [],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };

      const optimized = await contentOptimizer.optimizeForAI(poorContent);
      const isValid = contentOptimizer.validateOptimization(
        poorContent,
        optimized
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent extractions', async () => {
      const testHtml = `
        <html>
          <head><title>Concurrent Test</title></head>
          <body>
            <article>
              <h1>Test Article</h1>
              <p>Content for concurrent testing. This paragraph has enough text.</p>
            </article>
          </body>
        </html>
      `;

      const promises = Array.from({ length: 5 }, (_, i) =>
        readabilityService.extractArticleContent(
          testHtml,
          `https://example.com/test-${i}`
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.title).toBeTruthy();
        expect(result.textContent).toBeTruthy();
      });
    });

    it('should complete extraction within reasonable time', async () => {
      const start = Date.now();

      const testHtml = `
        <html>
          <head><title>Performance Test</title></head>
          <body>
            <article>
              <h1>Performance Test Article</h1>
              <p>${'Performance testing content. '.repeat(50)}</p>
            </article>
          </body>
        </html>
      `;

      const result = await readabilityService.extractArticleContent(
        testHtml,
        'https://example.com/performance-test'
      );

      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
