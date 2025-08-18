import { ContentExtractionService } from './ContentExtractionService';
import {
  ExtractedContent,
  ContentExtractionOptions,
} from '@neolink/shared/types/content';

/**
 * Legacy interface for backward compatibility
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

/**
 * Configuration for the content extraction adapter
 */
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
 * Adapter to bridge the new ContentExtractionService with the legacy interface
 */
export class ContentExtractionAdapter {
  private contentService: ContentExtractionService;
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
        '169.254.169.254', // AWS metadata
      ],
      enableCache: true,
      cacheTtl: 7 * 24 * 3600, // 7 days
      enableScreenshots: false, // Disabled by default for performance
      enableFullContent: true,
      ...config,
    };

    this.contentService = new ContentExtractionService({
      timeout: this.config.timeout,
      userAgent: 'NeoLink/1.0 (Bookmark Manager)',
    });
  }

  /**
   * Extract content using the new service and adapt to legacy interface
   */
  async extractContent(url: string): Promise<WebContentExtraction> {
    try {
      // Validate URL security
      this.validateUrlSecurity(url);

      // Configure extraction options
      const options: ContentExtractionOptions = {
        timeout: this.config.timeout,
        includeScreenshot: this.config.enableScreenshots,
        includeContent: this.config.enableFullContent,
        screenshotOptions: {
          type: 'png',
          fullPage: false,
        },
      };

      // Extract content using the new service
      const result = await this.contentService.extractContent(url, options);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Content extraction failed');
      }

      // Adapt to legacy interface
      return this.adaptToLegacyInterface(result.data);
    } catch (error) {
      console.error('Content extraction failed:', error);

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
   * Validate URL security (similar to EnhancedContentExtractionService)
   */
  private validateUrlSecurity(url: string): void {
    try {
      const urlObj = new URL(url);

      // Protocol validation
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error(`Unsupported protocol: ${urlObj.protocol}`);
      }

      // Blocked domains check
      if (this.config.blockedDomains) {
        const isBlocked = this.config.blockedDomains.some(
          (domain) =>
            urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );
        if (isBlocked) {
          throw new Error('Access to this domain is not allowed');
        }
      }

      // Allowed domains check (if configured)
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const isAllowed = this.config.allowedDomains.some(
          (domain) =>
            urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );
        if (!isAllowed) {
          throw new Error('Domain is not in the allowed list');
        }
      }

      // Private IP check
      if (this.isPrivateIP(urlObj.hostname)) {
        throw new Error('Access to private IP addresses is not allowed');
      }

      // Port check - only allow standard HTTP/HTTPS ports
      const port = urlObj.port;
      if (port && !['80', '443', '8080', '8443'].includes(port)) {
        throw new Error('Access to non-standard ports is not allowed');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Invalid URL format');
    }
  }

  /**
   * Check if hostname is a private IP address
   */
  private isPrivateIP(hostname: string): boolean {
    const privateIPRanges = [
      /^127\./, // 127.0.0.0/8 (localhost)
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^::1$/, // IPv6 localhost
      /^fe80:/, // IPv6 link-local
      /^fc00:/, // IPv6 unique local
    ];

    // IPv4 address check
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return privateIPRanges.some((range) => range.test(hostname));
    }

    // IPv6 address check
    if (hostname.includes(':')) {
      return privateIPRanges.some((range) => range.test(hostname));
    }

    return false;
  }

  /**
   * Adapt ExtractedContent to WebContentExtraction interface
   */
  private adaptToLegacyInterface(
    content: ExtractedContent
  ): WebContentExtraction {
    const urlObj = new URL(content.url);

    // Calculate word count and reading time
    const wordCount = content.textContent
      ? content.textContent.split(/\s+/).length
      : 0;
    const readingTime = Math.ceil(wordCount / 200); // 200 words per minute

    return {
      title: content.title?.substring(0, 200), // Limit title length
      description: content.description?.substring(0, 500), // Limit description length
      content: content.textContent?.substring(
        0,
        this.config.maxContentSize || 5000
      ), // Limit content length
      favicon: content.favicon,
      screenshot: content.screenshot,
      domain: urlObj.hostname,
      language: this.detectLanguage(content.textContent || ''),
      wordCount,
      readingTime,
    };
  }

  /**
   * Simple language detection
   */
  private detectLanguage(text: string): string {
    if (!text) return 'en';

    // Simple Chinese character detection
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalChars = text.length;

    if (chineseChars / totalChars > 0.3) {
      return 'zh';
    }
    return 'en';
  }

  /**
   * Check if service is ready
   */
  async isReady(): Promise<boolean> {
    return this.contentService.isReady();
  }

  /**
   * Close and cleanup resources
   */
  async close(): Promise<void> {
    await this.contentService.close();
  }
}
