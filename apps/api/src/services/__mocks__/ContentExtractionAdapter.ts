/**
 * Mock ContentExtractionAdapter for testing
 */

export interface WebContentExtraction {
  title?: string;
  description?: string;
  content?: string;
  favicon?: string;
  screenshot?: string;
  domain?: string;
  language?: string;
  wordCount?: number;
  readingTime?: number;
}

export interface ContentExtractionAdapterConfig {
  timeout?: number;
  maxContentSize?: number;
  blockedDomains?: string[];
  allowedDomains?: string[];
  enableCache?: boolean;
  cacheTtl?: number;
  enableScreenshots?: boolean;
  enableFullContent?: boolean;
}

/**
 * Mock ContentExtractionAdapter for testing
 */
export class ContentExtractionAdapter {
  private config: ContentExtractionAdapterConfig;

  constructor(config: ContentExtractionAdapterConfig = {}) {
    this.config = {
      timeout: 30000,
      maxContentSize: 50000,
      blockedDomains: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '169.254.169.254',
      ],
      enableCache: true,
      cacheTtl: 7 * 24 * 3600,
      enableScreenshots: false,
      enableFullContent: true,
      ...config,
    };
  }

  /**
   * Mock content extraction - returns predictable test data
   */
  async extractContent(url: string): Promise<WebContentExtraction> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const urlObj = new URL(url);

      // Return mock data based on URL for predictable testing
      if (url.includes('example.com')) {
        return {
          title: 'Test Page Title',
          description: 'Test page description',
          content: '<p>Test content</p>',
          favicon: 'https://example.com/favicon.ico',
          screenshot: '',
          domain: urlObj.hostname,
          language: 'en',
          wordCount: 3,
          readingTime: 1,
        };
      }

      if (url.includes('timeout-test')) {
        // Simulate timeout for timeout tests
        await new Promise((resolve) => setTimeout(resolve, 6000));
      }

      if (url.includes('error-test')) {
        throw new Error('Mock extraction error');
      }

      // Default mock response
      return {
        title: 'Mock Page Title',
        description: 'Mock page description',
        content: '<p>Mock content</p>',
        favicon: `${urlObj.origin}/favicon.ico`,
        screenshot: '',
        domain: urlObj.hostname,
        language: 'en',
        wordCount: 3,
        readingTime: 1,
      };
    } catch {
      // Return basic information on failure
      try {
        const urlObj = new URL(url);
        return {
          domain: urlObj.hostname,
          title: urlObj.hostname,
          description: 'Failed to extract page content',
        };
      } catch {
        return {
          title: 'Invalid URL',
          description: 'Failed to extract page content',
        };
      }
    }
  }

  /**
   * Mock service ready check
   */
  async isReady(): Promise<boolean> {
    return true;
  }

  /**
   * Mock cleanup
   */
  async close(): Promise<void> {
    // No-op for mock
  }
}
