import { Page } from 'puppeteer';
import { EnhancedMetadata } from '@neolink/shared/types/content';

/**
 * Service for extracting enhanced metadata from web pages
 */
export class MetadataExtractionService {
  /**
   * Extract enhanced metadata including JSON-LD, Open Graph, and Twitter Card data
   */
  async extractEnhancedMetadata(page: Page): Promise<EnhancedMetadata> {
    const metadata = await page.evaluate(() => {
      // Helper function to get meta content
      const getMetaContent = (nameOrProperty: string): string => {
        const meta = document.querySelector(
          `meta[name="${nameOrProperty}"], meta[property="${nameOrProperty}"]`
        );
        return meta?.getAttribute('content') || '';
      };

      // Basic meta tags
      const basic = {
        title: document.title || '',
        description:
          getMetaContent('description') ||
          getMetaContent('og:description') ||
          '',
        author:
          getMetaContent('author') || getMetaContent('article:author') || '',
        keywords: getMetaContent('keywords') || '',
      };

      // JSON-LD structured data
      const jsonLdScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      const structuredData = Array.from(jsonLdScripts)
        .map((script) => {
          try {
            return JSON.parse(script.textContent || '');
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Open Graph data
      const openGraph = {
        title: getMetaContent('og:title'),
        description: getMetaContent('og:description'),
        image: getMetaContent('og:image'),
        url: getMetaContent('og:url'),
        type: getMetaContent('og:type'),
        siteName: getMetaContent('og:site_name'),
      };

      // Twitter Card data
      const twitterCard = {
        card: getMetaContent('twitter:card'),
        title: getMetaContent('twitter:title'),
        description: getMetaContent('twitter:description'),
        image: getMetaContent('twitter:image'),
      };

      // Time information
      const timeInfo = {
        published:
          getMetaContent('article:published_time') ||
          getMetaContent('datePublished') ||
          getMetaContent('date') ||
          '',
        modified:
          getMetaContent('article:modified_time') ||
          getMetaContent('dateModified') ||
          getMetaContent('lastmod') ||
          '',
      };

      // Additional article metadata
      const articleMeta = {
        section: getMetaContent('article:section'),
        tags: getMetaContent('article:tag'),
        authorName: getMetaContent('article:author:name'),
        authorUrl: getMetaContent('article:author:url'),
        publisherName: getMetaContent('article:publisher'),
        locale: getMetaContent('og:locale'),
      };

      return {
        basic,
        structuredData,
        openGraph,
        twitterCard,
        timeInfo,
        articleMeta,
      };
    });

    // Process and validate the extracted metadata
    return this.processMetadata(metadata);
  }

  /**
   * Extract additional page structure information
   */
  async extractPageStructure(page: Page): Promise<{
    headings: Array<{ level: number; text: string; id?: string }>;
    navigation: Array<{ text: string; href: string }>;
    breadcrumbs: Array<{ text: string; href?: string }>;
    articleStructure: {
      hasAuthor: boolean;
      hasDate: boolean;
      hasReadingTime: boolean;
      wordCount?: number;
    };
  }> {
    return await page.evaluate(() => {
      // Extract headings with hierarchy
      const headings = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      )
        .map((heading) => ({
          level: parseInt(heading.tagName.charAt(1)),
          text: heading.textContent?.trim() || '',
          id: heading.id || undefined,
        }))
        .filter((h) => h.text.length > 0);

      // Extract navigation links
      const navigation = Array.from(
        document.querySelectorAll(
          'nav a, .navigation a, .nav a, [role="navigation"] a'
        )
      )
        .map((link) => ({
          text: link.textContent?.trim() || '',
          href: (link as HTMLAnchorElement).href || '',
        }))
        .filter((nav) => nav.text.length > 0 && nav.href)
        .slice(0, 20); // Limit to prevent too much data

      // Extract breadcrumbs
      const breadcrumbs = Array.from(
        document.querySelectorAll(
          '.breadcrumb a, .breadcrumbs a, [role="navigation"] ol a, .crumb a'
        )
      )
        .map((link) => ({
          text: link.textContent?.trim() || '',
          href: (link as HTMLAnchorElement).href || undefined,
        }))
        .filter((crumb) => crumb.text.length > 0);

      // Analyze article structure
      const articleStructure = {
        hasAuthor: !!(
          document.querySelector('.author, .byline, [rel="author"]') ||
          document.querySelector('meta[name="author"]')
        ),
        hasDate: !!(
          document.querySelector('time, .date, .published') ||
          document.querySelector('meta[property*="time"], meta[name*="date"]')
        ),
        hasReadingTime: !!document.querySelector('.reading-time, .read-time'),
        wordCount: document.body?.textContent?.split(/\s+/).length || 0,
      };

      return {
        headings,
        navigation,
        breadcrumbs,
        articleStructure,
      };
    });
  }

  /**
   * Process and validate metadata
   */
  private processMetadata(rawMetadata: any): EnhancedMetadata {
    const processed: EnhancedMetadata = {
      basic: {
        title: this.cleanText(rawMetadata.basic?.title || ''),
        description: this.cleanText(rawMetadata.basic?.description || ''),
        author: this.cleanText(rawMetadata.basic?.author || ''),
        keywords: this.cleanText(rawMetadata.basic?.keywords || ''),
      },
      structuredData: this.processStructuredData(
        rawMetadata.structuredData || []
      ),
      openGraph: this.processOpenGraph(rawMetadata.openGraph || {}),
      twitterCard: this.processTwitterCard(rawMetadata.twitterCard || {}),
      timeInfo: this.processTimeInfo(rawMetadata.timeInfo || {}),
    };

    return processed;
  }

  /**
   * Process structured data (JSON-LD)
   */
  private processStructuredData(data: any[]): any[] {
    return data
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        // Clean and validate JSON-LD data
        if (item['@type']) {
          return {
            type: item['@type'],
            name: item.name || item.headline || '',
            description: item.description || '',
            author: item.author?.name || item.author || '',
            datePublished: item.datePublished || '',
            dateModified: item.dateModified || '',
            publisher: item.publisher?.name || item.publisher || '',
            url: item.url || '',
            image: item.image?.url || item.image || '',
          };
        }
        return item;
      })
      .slice(0, 5); // Limit to prevent excessive data
  }

  /**
   * Process Open Graph data
   */
  private processOpenGraph(og: any): EnhancedMetadata['openGraph'] {
    return {
      title: this.cleanText(og.title || ''),
      description: this.cleanText(og.description || ''),
      image: this.validateUrl(og.image || ''),
      url: this.validateUrl(og.url || ''),
      type: og.type || '',
      siteName: this.cleanText(og.siteName || ''),
    };
  }

  /**
   * Process Twitter Card data
   */
  private processTwitterCard(twitter: any): EnhancedMetadata['twitterCard'] {
    return {
      card: twitter.card || '',
      title: this.cleanText(twitter.title || ''),
      description: this.cleanText(twitter.description || ''),
      image: this.validateUrl(twitter.image || ''),
    };
  }

  /**
   * Process time information
   */
  private processTimeInfo(timeInfo: any): EnhancedMetadata['timeInfo'] {
    return {
      published: this.validateDate(timeInfo.published || ''),
      modified: this.validateDate(timeInfo.modified || ''),
    };
  }

  /**
   * Clean and trim text content
   */
  private cleanText(text: string): string {
    if (!text) return '';

    return text.replace(/\s+/g, ' ').trim().substring(0, 500); // Limit length
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): string {
    if (!url) return '';

    try {
      new URL(url);
      return url;
    } catch {
      // If it's a relative URL, return as-is for later resolution
      return url.startsWith('/') ? url : '';
    }
  }

  /**
   * Validate and normalize date strings
   */
  private validateDate(dateStr: string): string {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toISOString();
    } catch {
      return '';
    }
  }

  /**
   * Extract social media metadata
   */
  async extractSocialMetadata(page: Page): Promise<{
    facebook: { appId?: string; adminIds?: string[] };
    twitter: { site?: string; creator?: string };
    linkedin: { company?: string };
  }> {
    return await page.evaluate(() => {
      const getMetaContent = (nameOrProperty: string): string => {
        const meta = document.querySelector(
          `meta[name="${nameOrProperty}"], meta[property="${nameOrProperty}"]`
        );
        return meta?.getAttribute('content') || '';
      };

      return {
        facebook: {
          appId: getMetaContent('fb:app_id'),
          adminIds: getMetaContent('fb:admins').split(',').filter(Boolean),
        },
        twitter: {
          site: getMetaContent('twitter:site'),
          creator: getMetaContent('twitter:creator'),
        },
        linkedin: {
          company: getMetaContent('linkedin:company'),
        },
      };
    });
  }
}
