import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadabilityService } from './ReadabilityService';
import { LanguageDetector } from '../utils/LanguageDetector';
import { ContentOptimizer } from '../utils/ContentOptimizer';
import { ExtractionError } from '@neolink/shared/types/content';

// Mock dependencies
vi.mock('@mozilla/readability');
vi.mock('jsdom');
vi.mock('../utils/LanguageDetector');
vi.mock('../utils/ContentOptimizer');

describe('ReadabilityService', () => {
  let service: ReadabilityService;
  let mockLanguageDetector: vi.Mocked<LanguageDetector>;
  let mockContentOptimizer: vi.Mocked<ContentOptimizer>;

  beforeEach(() => {
    mockLanguageDetector = {
      detectLanguage: vi.fn(),
    } as any;

    mockContentOptimizer = {
      optimizeForAI: vi.fn(),
    } as any;

    service = new ReadabilityService(
      mockLanguageDetector,
      mockContentOptimizer
    );
  });

  describe('extractArticleContent', () => {
    const mockHtml = `
      <html>
        <head>
          <title>Test Article</title>
          <meta name="description" content="A test article">
        </head>
        <body>
          <article>
            <h1>Main Title</h1>
            <p class="byline">By Test Author</p>
            <p>This is the first paragraph of the article.</p>
            <h2>Subtitle</h2>
            <p>This is another paragraph with more content.</p>
            <ul>
              <li>List item 1</li>
              <li>List item 2</li>
            </ul>
          </article>
        </body>
      </html>
    `;

    it('should extract readable content successfully', async () => {
      // Mock Readability
      const mockReadability = {
        parse: vi.fn().mockReturnValue({
          title: 'Test Article',
          byline: 'By Test Author',
          content:
            '<h1>Main Title</h1><p>This is the first paragraph of the article.</p>',
          excerpt: 'A test article',
          siteName: 'Test Site',
          length: 100,
        }),
      };

      // Mock JSDOM
      const mockJSDOM = {
        window: {
          document: {
            body: {
              textContent:
                'Test Article By Test Author This is the first paragraph...',
            },
          },
        },
      };

      // Mock language detection
      mockLanguageDetector.detectLanguage.mockResolvedValue({
        code: 'en',
        name: 'English',
        confidence: 0.9,
      });

      // Mock modules
      const { Readability } = await import('@mozilla/readability');
      const { JSDOM } = await import('jsdom');

      vi.mocked(Readability).mockImplementation(() => mockReadability as any);
      vi.mocked(JSDOM).mockImplementation(() => mockJSDOM as any);

      const result = await service.extractArticleContent(
        mockHtml,
        'https://example.com'
      );

      expect(result).toMatchObject({
        title: 'Test Article',
        byline: 'By Test Author',
        excerpt: 'A test article',
        siteName: 'Test Site',
        language: {
          code: 'en',
          name: 'English',
          confidence: 0.9,
        },
      });

      expect(mockLanguageDetector.detectLanguage).toHaveBeenCalled();
    });

    it('should handle Readability parse failure and fallback', async () => {
      // Mock Readability to fail
      const mockReadability = {
        parse: vi.fn().mockReturnValue(null),
      };

      const mockJSDOM = {
        window: {
          document: {
            title: 'Fallback Title',
            querySelector: vi.fn().mockReturnValue({
              getAttribute: vi.fn().mockReturnValue('Fallback description'),
            }),
            body: {
              textContent: 'Fallback content text',
              innerHTML: '<div>Fallback content</div>',
            },
          },
        },
      };

      const { Readability } = await import('@mozilla/readability');
      const { JSDOM } = await import('jsdom');

      vi.mocked(Readability).mockImplementation(() => mockReadability as any);
      vi.mocked(JSDOM).mockImplementation(() => mockJSDOM as any);

      mockLanguageDetector.detectLanguage.mockResolvedValue({
        code: 'en',
        name: 'English',
        confidence: 0.3,
      });

      const result = await service.extractArticleContent(
        mockHtml,
        'https://example.com'
      );

      expect(result.title).toBe('Fallback Title');
      expect(result.textContent).toContain('Fallback content text');
    });

    it('should limit content length correctly', async () => {
      const longContent = 'word '.repeat(2000); // 10000 characters

      const mockReadability = {
        parse: vi.fn().mockReturnValue({
          title: 'Long Article',
          byline: 'Author',
          content: `<p>${longContent}</p>`,
          excerpt: 'A long article',
          siteName: 'Test Site',
          length: 10000,
        }),
      };

      const mockJSDOM = {
        window: {
          document: {
            body: {
              textContent: longContent,
            },
          },
        },
      };

      const { Readability } = await import('@mozilla/readability');
      const { JSDOM } = await import('jsdom');

      vi.mocked(Readability).mockImplementation(() => mockReadability as any);
      vi.mocked(JSDOM).mockImplementation(() => mockJSDOM as any);

      mockLanguageDetector.detectLanguage.mockResolvedValue({
        code: 'en',
        name: 'English',
        confidence: 0.9,
      });

      const result = await service.extractArticleContent(
        mockHtml,
        'https://example.com',
        1000
      );

      expect(result.textContent.length).toBeLessThanOrEqual(1000);
    });

    it('should extract structured data correctly', async () => {
      const htmlWithStructuredData = `
        <div>
          <h1>Main Title</h1>
          <h2>Subtitle</h2>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <table>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
            <tr><td>Cell 3</td><td>Cell 4</td></tr>
          </table>
          <img src="test.jpg" alt="Test image" />
        </div>
      `;

      const mockReadability = {
        parse: vi.fn().mockReturnValue({
          title: 'Test Article',
          byline: 'Author',
          content: htmlWithStructuredData,
          excerpt: 'Test excerpt',
          siteName: 'Test Site',
          length: 100,
        }),
      };

      const mockDocument = {
        body: {
          textContent:
            'Main Title Subtitle Item 1 Item 2 Cell 1 Cell 2 Cell 3 Cell 4',
        },
        querySelectorAll: vi.fn((selector: string) => {
          if (selector === 'h1, h2, h3, h4, h5, h6') {
            return [
              { tagName: 'H1', textContent: 'Main Title' },
              { tagName: 'H2', textContent: 'Subtitle' },
            ];
          }
          if (selector === 'ul, ol') {
            return [
              {
                tagName: 'UL',
                querySelectorAll: vi
                  .fn()
                  .mockReturnValue([
                    { textContent: 'Item 1' },
                    { textContent: 'Item 2' },
                  ]),
              },
            ];
          }
          if (selector === 'table') {
            return [
              {
                querySelectorAll: vi.fn().mockReturnValue([
                  {
                    querySelectorAll: vi
                      .fn()
                      .mockReturnValue([
                        { textContent: 'Cell 1' },
                        { textContent: 'Cell 2' },
                      ]),
                  },
                  {
                    querySelectorAll: vi
                      .fn()
                      .mockReturnValue([
                        { textContent: 'Cell 3' },
                        { textContent: 'Cell 4' },
                      ]),
                  },
                ]),
              },
            ];
          }
          if (selector === 'img') {
            return [
              {
                getAttribute: vi.fn((attr: string) =>
                  attr === 'src' ? 'test.jpg' : 'Test image'
                ),
              },
            ];
          }
          return [];
        }),
      };

      const mockJSDOM = {
        window: { document: mockDocument },
      };

      const { Readability } = await import('@mozilla/readability');
      const { JSDOM } = await import('jsdom');

      vi.mocked(Readability).mockImplementation(() => mockReadability as any);
      vi.mocked(JSDOM).mockImplementation(() => mockJSDOM as any);

      mockLanguageDetector.detectLanguage.mockResolvedValue({
        code: 'en',
        name: 'English',
        confidence: 0.9,
      });

      const result = await service.extractArticleContent(
        htmlWithStructuredData,
        'https://example.com'
      );

      expect(result.structuredData.headings).toHaveLength(2);
      expect(result.structuredData.headings[0]).toMatchObject({
        level: 1,
        text: 'Main Title',
      });
      expect(result.structuredData.lists).toHaveLength(1);
      expect(result.structuredData.tables).toHaveLength(1);
      expect(result.structuredData.images).toHaveLength(1);
    });

    it('should handle extraction errors properly', async () => {
      const { JSDOM } = await import('jsdom');

      // Mock JSDOM to throw an error
      vi.mocked(JSDOM).mockImplementation(() => {
        throw new Error('DOM parsing failed');
      });

      await expect(
        service.extractArticleContent(mockHtml, 'https://example.com')
      ).rejects.toThrow(ExtractionError);
    });
  });
});
