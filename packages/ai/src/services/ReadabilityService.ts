import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import {
  ReadableContent,
  StructuredData,
  ExtractionError,
  ExtractionErrorCode,
} from '@neolink/shared/types/content';
import { LanguageDetector } from '../utils/LanguageDetector';
import { ContentOptimizer } from '../utils/ContentOptimizer';

/**
 * Service for extracting readable content using Mozilla Readability
 */
export class ReadabilityService {
  private languageDetector: LanguageDetector;
  private contentOptimizer: ContentOptimizer;

  constructor(
    languageDetector?: LanguageDetector,
    contentOptimizer?: ContentOptimizer
  ) {
    this.languageDetector = languageDetector || new LanguageDetector();
    this.contentOptimizer = contentOptimizer || new ContentOptimizer();
  }

  /**
   * Extract article content using Readability.js
   */
  async extractArticleContent(
    html: string,
    url: string,
    maxLength: number = 4000
  ): Promise<ReadableContent> {
    try {
      // 1. Create DOM environment
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // 2. Use Readability to extract content
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        throw new ExtractionError(
          'Failed to extract readable content',
          ExtractionErrorCode.READABILITY_FAILED
        );
      }

      // 3. Clean and format content
      const cleanContent = this.cleanContent(article.content, url);
      const textContent = this.extractTextContent(article.content);
      const structuredData = this.extractStructuredData(article.content);

      // 4. Language detection
      const language = await this.languageDetector.detectLanguage(textContent);

      // 5. Content length control
      const processedContent = this.limitContentLength(textContent, maxLength);

      return {
        title: article.title || '',
        byline: article.byline || '',
        content: cleanContent,
        textContent: processedContent,
        excerpt: article.excerpt || '',
        siteName: article.siteName || '',
        language,
        length: article.length || 0,
        structuredData,
        extractedAt: new Date(),
      };
    } catch (error) {
      if (
        error instanceof ExtractionError &&
        error.code !== ExtractionErrorCode.READABILITY_FAILED
      ) {
        throw error;
      }
      // Fallback to basic HTML parsing for readability failures and other errors
      return this.fallbackExtraction(html, url);
    }
  }

  /**
   * Clean HTML content
   */
  private cleanContent(content: string, baseUrl?: string): string {
    if (!content) return '';

    try {
      // Remove script, style, and comment elements
      let cleaned = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

      // Normalize whitespace
      cleaned = cleaned
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      // Convert relative links to absolute URLs (improved implementation)
      // This properly converts relative URLs using the base URL
      if (baseUrl) {
        cleaned = this.convertRelativeUrls(cleaned, baseUrl);
      }

      return cleaned;
    } catch (error) {
      console.warn('Failed to clean content:', error);
      return content;
    }
  }

  /**
   * Extract structured data from content
   */
  private extractStructuredData(content: string): StructuredData {
    const dom = new JSDOM(content);
    const document = dom.window.document;

    const structuredData: StructuredData = {
      headings: [],
      lists: [],
      tables: [],
      images: [],
    };

    try {
      // Extract headings with hierarchy
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading) => {
        if (heading.textContent) {
          structuredData.headings.push({
            level: parseInt(heading.tagName.charAt(1)),
            text: heading.textContent.trim(),
          });
        }
      });

      // Extract lists
      const lists = document.querySelectorAll('ul, ol');
      lists.forEach((list) => {
        const items: string[] = [];
        const listItems = list.querySelectorAll('li');
        listItems.forEach((item) => {
          if (item.textContent) {
            items.push(item.textContent.trim());
          }
        });

        if (items.length > 0) {
          structuredData.lists.push({
            type: list.tagName.toLowerCase() as 'ul' | 'ol',
            items,
          });
        }
      });

      // Extract tables
      const tables = document.querySelectorAll('table');
      tables.forEach((table) => {
        const rows: string[][] = [];
        const tableRows = table.querySelectorAll('tr');

        tableRows.forEach((row) => {
          const cells: string[] = [];
          const tableCells = row.querySelectorAll('td, th');
          tableCells.forEach((cell) => {
            if (cell.textContent) {
              cells.push(cell.textContent.trim());
            }
          });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

        if (rows.length > 0) {
          structuredData.tables.push({ rows });
        }
      });

      // Extract images
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt');
        if (src) {
          structuredData.images.push({
            src,
            alt: alt || '',
          });
        }
      });
    } catch (error) {
      console.warn('Failed to extract structured data:', error);
    }

    return structuredData;
  }

  /**
   * Extract text content from HTML
   */
  private extractTextContent(html: string): string {
    if (!html) return '';

    try {
      const dom = new JSDOM(html);
      const textContent = dom.window.document.body?.textContent || '';

      // Clean up whitespace
      return textContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
    } catch (error) {
      console.warn('Failed to extract text content:', error);
      // Fallback to simple regex-based extraction
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  /**
   * Limit content length with intelligent truncation
   */
  private limitContentLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Smart truncation - try to break at sentence boundaries
    const sentences = text.split(/[.!?]+\s+/);
    let result = '';

    for (const sentence of sentences) {
      const newLength = result.length + sentence.length + (result ? 2 : 0);
      if (newLength > maxLength) {
        break;
      }
      result += (result ? '. ' : '') + sentence;
    }

    // If no complete sentences fit, truncate at word boundary
    if (!result && text.length > maxLength) {
      const words = text.substring(0, maxLength - 3).split(' ');
      if (words.length > 1) {
        words.pop(); // Remove potentially truncated last word
        result = words.join(' ') + '...';
      } else {
        result = text.substring(0, maxLength - 3) + '...';
      }
    }

    // Ensure we don't exceed maxLength
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }

    return result || text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Convert relative URLs to absolute URLs in HTML content
   */
  private convertRelativeUrls(html: string, baseUrl: string): string {
    try {
      const base = new URL(baseUrl);

      // Convert relative href attributes
      html = html.replace(/href="([^"]*?)"/g, (match, url) => {
        try {
          if (
            url.startsWith('http://') ||
            url.startsWith('https://') ||
            url.startsWith('//')
          ) {
            return match; // Already absolute
          }
          const absoluteUrl = new URL(url, base).href;
          return `href="${absoluteUrl}"`;
        } catch {
          return match; // Keep original if conversion fails
        }
      });

      // Convert relative src attributes
      html = html.replace(/src="([^"]*?)"/g, (match, url) => {
        try {
          if (
            url.startsWith('http://') ||
            url.startsWith('https://') ||
            url.startsWith('//')
          ) {
            return match; // Already absolute
          }
          const absoluteUrl = new URL(url, base).href;
          return `src="${absoluteUrl}"`;
        } catch {
          return match; // Keep original if conversion fails
        }
      });

      return html;
    } catch (error) {
      console.warn('Failed to convert relative URLs:', error);
      return html;
    }
  }

  /**
   * Fallback extraction using basic HTML parsing
   */
  private fallbackExtraction(html: string, url: string): ReadableContent {
    try {
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Extract title
      const title = document.title || 'Untitled';

      // Extract meta description
      const metaDescription = document.querySelector(
        'meta[name="description"]'
      );
      const description = metaDescription?.getAttribute('content') || '';

      // Extract text content from body
      const body = document.body;
      const textContent = body?.textContent || '';

      // Basic content cleaning
      const cleanText = textContent
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 4000);

      return {
        title,
        byline: '',
        content: body?.innerHTML || '',
        textContent: cleanText,
        excerpt: description,
        siteName: new URL(url).hostname,
        language: { code: 'en', name: 'English', confidence: 0.3 },
        length: cleanText.length,
        structuredData: {
          headings: [],
          lists: [],
          tables: [],
          images: [],
        },
        extractedAt: new Date(),
      };
    } catch (error) {
      throw new ExtractionError(
        'Fallback extraction failed',
        ExtractionErrorCode.HTML_PARSE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }
}
