import puppeteer, { Browser, Page } from 'puppeteer';
import { URL } from 'url';
import {
  ExtractedContent,
  BasicPageInfo,
  ContentExtractionOptions,
  ContentExtractionResult,
  ContentExtractionError,
  TimeoutError,
  NetworkError,
  BrowserError,
  ReadableContent,
  ExtractionError,
  ExtractionErrorCode,
} from '@neolink/shared/types/content';
import { ContentConfig, getContentConfig } from '../config/content';
import { ReadabilityService } from './ReadabilityService';
import { MetadataExtractionService } from './MetadataExtractionService';

/**
 * Content extraction service using Puppeteer
 */
export class ContentExtractionService {
  private browser: Browser | null = null;
  private config: ContentConfig;
  private isShuttingDown = false;
  private readabilityService: ReadabilityService;
  private metadataService: MetadataExtractionService;

  constructor(config?: Partial<ContentConfig>) {
    this.config = { ...getContentConfig(), ...config };
    this.readabilityService = new ReadabilityService();
    this.metadataService = new MetadataExtractionService();
  }

  /**
   * Extract content from a URL
   */
  async extractContent(
    url: string,
    options: ContentExtractionOptions = {}
  ): Promise<ContentExtractionResult> {
    const startTime = Date.now();

    try {
      // Validate URL
      this.validateUrl(url);

      // Get browser instance
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      try {
        // Configure page
        await this.configurePage(page, options);

        // Navigate to page with timeout
        await this.navigateToPage(page, url, options.timeout);

        // Extract basic page information
        const basicInfo = await this.extractBasicInfo(page);

        // Extract enhanced metadata
        const enhancedMetadata =
          await this.metadataService.extractEnhancedMetadata(page);

        // Extract content using enhanced methods
        const html = await page.content();
        let readableContent: ReadableContent | null = null;
        let content = '';
        let textContent = '';

        if (options.includeContent !== false) {
          try {
            // Try enhanced extraction with Readability
            readableContent = await this.extractReadableContent(html, url);
            content = readableContent.content;
            textContent = readableContent.textContent;
          } catch (error) {
            console.warn(
              'Enhanced extraction failed, falling back to basic:',
              error
            );
            // Fallback to basic extraction
            content = await this.extractPageContent(page);
            textContent = this.extractTextContent(content);
          }
        }

        // Take screenshot if requested
        const screenshot = options.includeScreenshot
          ? await this.takeScreenshot(page, options.screenshotOptions)
          : '';

        const extractedContent: ExtractedContent = {
          url,
          title:
            readableContent?.title ||
            enhancedMetadata.openGraph.title ||
            enhancedMetadata.basic.title ||
            basicInfo.title,
          description:
            readableContent?.excerpt ||
            enhancedMetadata.openGraph.description ||
            enhancedMetadata.basic.description ||
            basicInfo.description,
          favicon: this.resolveUrl(basicInfo.favicon, url),
          author:
            readableContent?.byline ||
            enhancedMetadata.basic.author ||
            basicInfo.author,
          content,
          textContent,
          screenshot,
          extractedAt: new Date(),
        };

        return {
          success: true,
          data: extractedContent,
          extractionTime: Date.now() - startTime,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error('Content extraction failed:', error);

      // Try fallback extraction
      try {
        const fallbackResult = await this.fallbackExtraction(url);
        return {
          success: true,
          data: fallbackResult,
          fallbackUsed: true,
          extractionTime: Date.now() - startTime,
        };
      } catch {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          extractionTime: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      try {
        this.browser = await puppeteer.launch(this.config.puppeteerOptions);
      } catch (error) {
        throw new BrowserError('Failed to launch browser', error as Error);
      }
    }
    return this.browser;
  }

  /**
   * Configure page settings
   */
  private async configurePage(
    page: Page,
    options: ContentExtractionOptions
  ): Promise<void> {
    try {
      // Set viewport
      await page.setViewport(this.config.viewport);

      // Set user agent
      const userAgent = options.userAgent || this.config.userAgent;
      await page.setUserAgent(userAgent);

      // Set timeout
      const timeout = options.timeout || this.config.timeout;
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);

      // Block unnecessary resources to speed up loading
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
    } catch (error) {
      throw new BrowserError('Failed to configure page', error as Error);
    }
  }

  /**
   * Navigate to page with error handling
   */
  private async navigateToPage(
    page: Page,
    url: string,
    timeout?: number
  ): Promise<void> {
    try {
      const navigationTimeout = timeout || this.config.timeout;

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: navigationTimeout,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new TimeoutError(timeout || this.config.timeout, error);
      }
      throw new NetworkError('Failed to navigate to page', error as Error);
    }
  }

  /**
   * Extract basic page information
   */
  private async extractBasicInfo(page: Page): Promise<BasicPageInfo> {
    try {
      return await page.evaluate(() => {
        const getMetaContent = (name: string): string => {
          const meta = document.querySelector(
            `meta[name="${name}"], meta[property="${name}"]`
          );
          return meta?.getAttribute('content') || '';
        };

        const getFavicon = (): string => {
          const favicon = document.querySelector(
            'link[rel="icon"], link[rel="shortcut icon"]'
          );
          return favicon?.getAttribute('href') || '/favicon.ico';
        };

        return {
          title: document.title || '',
          description:
            getMetaContent('description') ||
            getMetaContent('og:description') ||
            '',
          favicon: getFavicon(),
          author:
            getMetaContent('author') || getMetaContent('article:author') || '',
        };
      });
    } catch (error) {
      throw new ContentExtractionError(
        'Failed to extract basic info',
        'EXTRACTION_ERROR',
        error as Error
      );
    }
  }

  /**
   * Extract page content
   */
  private async extractPageContent(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());

        // Try to find main content area
        const contentSelectors = [
          'main',
          'article',
          '[role="main"]',
          '.content',
          '.post-content',
          '.entry-content',
          '#content',
        ];

        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (
            element &&
            element.textContent &&
            element.textContent.trim().length > 100
          ) {
            return element.innerHTML;
          }
        }

        // Fallback to body content
        return document.body?.innerHTML || '';
      });
    } catch (error) {
      console.warn('Failed to extract page content:', error);
      return '';
    }
  }

  /**
   * Take screenshot of the page
   */
  private async takeScreenshot(
    page: Page,
    options?: ContentExtractionOptions['screenshotOptions']
  ): Promise<string> {
    try {
      const screenshotOptions = {
        ...this.config.screenshotOptions,
        ...options,
      };

      const screenshot = await page.screenshot({
        type: screenshotOptions.type,
        quality: screenshotOptions.quality,
        fullPage: screenshotOptions.fullPage,
        encoding: 'base64',
      });

      return `data:image/${screenshotOptions.type};base64,${screenshot}`;
    } catch (error) {
      console.warn('Failed to take screenshot:', error);
      return '';
    }
  }

  /**
   * Extract text content from HTML
   */
  private extractTextContent(html: string): string {
    if (!html) return '';

    try {
      // Simple HTML to text conversion
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (error) {
      console.warn('Failed to extract text content:', error);
      return '';
    }
  }

  /**
   * Resolve relative URL to absolute URL
   */
  private resolveUrl(relativeUrl: string, baseUrl: string): string {
    if (!relativeUrl) return '';

    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported');
      }
    } catch (error) {
      throw new ContentExtractionError(
        'Invalid URL format',
        'INVALID_URL',
        error as Error
      );
    }
  }

  /**
   * Fallback extraction using simple HTTP request
   */
  private async fallbackExtraction(url: string): Promise<ExtractedContent> {
    // This is a simplified fallback - in a real implementation,
    // you might use a library like cheerio to parse HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent,
      },
    });

    if (!response.ok) {
      throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );

    return {
      url,
      title: titleMatch?.[1] || 'Untitled',
      description: descMatch?.[1] || '',
      favicon: this.resolveUrl('/favicon.ico', url),
      author: '',
      content: '',
      textContent: '',
      screenshot: '',
      extractedAt: new Date(),
    };
  }

  /**
   * Close browser and cleanup resources
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
      this.browser = null;
    }
  }

  /**
   * Extract readable content using Readability.js
   */
  private async extractReadableContent(
    html: string,
    url: string
  ): Promise<ReadableContent> {
    return await this.readabilityService.extractArticleContent(html, url);
  }

  /**
   * Extract content with multiple fallback strategies
   */
  async extractContentWithFallback(
    url: string,
    options: ContentExtractionOptions = {}
  ): Promise<ContentExtractionResult> {
    const strategies = [
      () => this.extractWithReadability(url, options),
      () => this.extractContent(url, options),
      () => this.extractMetadataOnly(url, options),
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        const result = await strategy();

        // Validate extraction quality
        if (result.success && this.validateExtractionQuality(result.data!)) {
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn('Content extraction strategy failed:', error);
        continue;
      }
    }

    // All strategies failed
    return {
      success: false,
      error: lastError?.message || 'All content extraction strategies failed',
      extractionTime: 0,
    };
  }

  /**
   * Extract content using Readability first
   */
  private async extractWithReadability(
    url: string,
    options: ContentExtractionOptions
  ): Promise<ContentExtractionResult> {
    const startTime = Date.now();

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      try {
        await this.configurePage(page, options);
        await this.navigateToPage(page, url, options.timeout);

        const html = await page.content();
        const readableContent = await this.extractReadableContent(html, url);

        const extractedContent: ExtractedContent = {
          url,
          title: readableContent.title,
          description: readableContent.excerpt,
          favicon: this.resolveUrl('/favicon.ico', url),
          author: readableContent.byline,
          content: readableContent.content,
          textContent: readableContent.textContent,
          screenshot: options.includeScreenshot
            ? await this.takeScreenshot(page, options.screenshotOptions)
            : '',
          extractedAt: new Date(),
        };

        return {
          success: true,
          data: extractedContent,
          extractionTime: Date.now() - startTime,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      throw new ExtractionError(
        'Readability extraction failed',
        ExtractionErrorCode.READABILITY_FAILED,
        error as Error
      );
    }
  }

  /**
   * Extract metadata only (minimal extraction)
   */
  private async extractMetadataOnly(
    url: string,
    options: ContentExtractionOptions
  ): Promise<ContentExtractionResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': options.userAgent || this.config.userAgent,
        },
      });

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      );

      const extractedContent: ExtractedContent = {
        url,
        title: titleMatch?.[1] || 'Untitled',
        description: descMatch?.[1] || '',
        favicon: this.resolveUrl('/favicon.ico', url),
        author: '',
        content: '',
        textContent: '',
        screenshot: '',
        extractedAt: new Date(),
      };

      return {
        success: true,
        data: extractedContent,
        fallbackUsed: true,
        extractionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new ExtractionError(
        'Metadata extraction failed',
        ExtractionErrorCode.HTML_PARSE_FAILED,
        error as Error
      );
    }
  }

  /**
   * Validate extraction quality
   */
  private validateExtractionQuality(content: ExtractedContent): boolean {
    // Basic quality checks
    if (!content.title || content.title.length === 0) {
      return false;
    }

    if (content.textContent && content.textContent.length < 50) {
      return false;
    }

    return true;
  }

  /**
   * Check if service is ready
   */
  async isReady(): Promise<boolean> {
    try {
      const browser = await this.getBrowser();
      return browser.isConnected();
    } catch {
      return false;
    }
  }
}
