import { Redis } from 'ioredis';
import { z } from 'zod';

/**
 * 网页内容提取结果接口
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
 * 内容提取配置
 */
export interface ContentExtractionConfig {
  redis?: Redis;
  timeout: number;
  maxContentSize: number;
  allowedDomains?: string[];
  blockedDomains: string[];
  enableCache: boolean;
  cacheTtl: number;
}

/**
 * URL安全验证Schema
 */
const URLValidationSchema = z.object({
  url: z.string().url('无效的URL格式'),
});

/**
 * 增强的网页内容提取服务
 * 解决质量门报告中的安全和性能问题
 */
export class EnhancedContentExtractionService {
  private readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];
  private readonly BLOCKED_DOMAINS: string[];
  private readonly ALLOWED_DOMAINS?: string[];
  private readonly TIMEOUT_MS: number;
  private readonly MAX_CONTENT_SIZE: number;
  private readonly redis?: Redis;
  private readonly enableCache: boolean;
  private readonly cacheTtl: number;

  // 私有IP地址范围 (RFC 1918)
  private readonly PRIVATE_IP_RANGES = [
    /^127\./, // 127.0.0.0/8 (localhost)
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // 169.254.0.0/16 (link-local)
    /^::1$/, // IPv6 localhost
    /^fe80:/, // IPv6 link-local
    /^fc00:/, // IPv6 unique local
  ];

  // 特殊域名和IP
  private readonly SPECIAL_DOMAINS = [
    'localhost',
    '0.0.0.0',
    '169.254.169.254', // AWS metadata
    'metadata.google.internal', // GCP metadata
    '100.100.100.200', // Alibaba Cloud metadata
  ];

  constructor(config: ContentExtractionConfig) {
    this.BLOCKED_DOMAINS = [...config.blockedDomains, ...this.SPECIAL_DOMAINS];
    this.ALLOWED_DOMAINS = config.allowedDomains;
    this.TIMEOUT_MS = config.timeout;
    this.MAX_CONTENT_SIZE = config.maxContentSize;
    this.redis = config.redis;
    this.enableCache = config.enableCache;
    this.cacheTtl = config.cacheTtl;
  }

  /**
   * 增强的URL安全验证
   */
  private async validateUrlSecurity(url: string): Promise<void> {
    // 基础URL格式验证
    const validation = URLValidationSchema.safeParse({ url });
    if (!validation.success) {
      throw new Error('无效的URL格式');
    }

    const urlObj = new URL(url);

    // 协议验证
    if (!this.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      throw new Error(`不支持的协议: ${urlObj.protocol}`);
    }

    // 域名白名单检查（如果配置了）
    if (this.ALLOWED_DOMAINS && this.ALLOWED_DOMAINS.length > 0) {
      const isAllowed = this.ALLOWED_DOMAINS.some(
        (domain) =>
          urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        throw new Error('域名不在允许列表中');
      }
    }

    // 黑名单域名检查
    const isBlocked = this.BLOCKED_DOMAINS.some(
      (domain) =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
    if (isBlocked) {
      throw new Error('不允许访问此域名');
    }

    // 私有IP地址检查
    const hostname = urlObj.hostname;
    if (this.isPrivateIP(hostname)) {
      throw new Error('不允许访问私有IP地址');
    }

    // 端口检查 - 只允许标准HTTP/HTTPS端口
    const port = urlObj.port;
    if (port && !['80', '443', '8080', '8443'].includes(port)) {
      throw new Error('不允许访问非标准端口');
    }
  }

  /**
   * 检查是否为私有IP地址
   */
  private isPrivateIP(hostname: string): boolean {
    // IPv4地址检查
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return this.PRIVATE_IP_RANGES.some((range) => range.test(hostname));
    }

    // IPv6地址检查
    if (hostname.includes(':')) {
      return this.PRIVATE_IP_RANGES.some((range) => range.test(hostname));
    }

    return false;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(url: string): string {
    return `content_extraction:${Buffer.from(url).toString('base64')}`;
  }

  /**
   * 从缓存获取内容
   */
  private async getFromCache(
    url: string
  ): Promise<WebContentExtraction | null> {
    if (!this.enableCache || !this.redis) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(url);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Cache read failed:', error);
    }

    return null;
  }

  /**
   * 保存到缓存
   */
  private async saveToCache(
    url: string,
    content: WebContentExtraction
  ): Promise<void> {
    if (!this.enableCache || !this.redis) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(url);
      await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(content));
    } catch (error) {
      console.warn('Cache write failed:', error);
    }
  }

  /**
   * 提取网页内容（同步版本，用于向后兼容）
   */
  async extractContent(url: string): Promise<WebContentExtraction> {
    try {
      // 安全验证
      await this.validateUrlSecurity(url);

      // 缓存检查
      const cached = await this.getFromCache(url);
      if (cached) {
        return cached;
      }

      const urlObj = new URL(url);

      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'NeoLink/1.0 (Bookmark Manager)',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            DNT: '1',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 检查内容类型（安全地处理headers）
        let contentType = '';
        try {
          contentType = response.headers?.get?.('content-type') || '';
        } catch {
          // 在测试环境中可能没有正确的headers实现
          contentType = 'text/html';
        }

        if (contentType && !contentType.includes('text/html')) {
          throw new Error('不支持的内容类型，仅支持 HTML 页面');
        }

        const html = await response.text();

        // 验证内容大小
        if (html.length > this.MAX_CONTENT_SIZE) {
          throw new Error('页面内容过大，超过允许的最大大小');
        }

        const extractedContent = this.parseHtmlContent(html, urlObj);

        // 保存到缓存
        await this.saveToCache(url, extractedContent);

        return extractedContent;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('Content extraction failed:', error);

      // 根据错误类型返回不同的错误信息
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('网页内容提取超时');
        }
        if (
          error.message.includes('不支持的协议') ||
          error.message.includes('不允许访问') ||
          error.message.includes('不支持的内容类型') ||
          error.message.includes('域名不在允许列表中')
        ) {
          throw error; // 重新抛出安全相关错误
        }
      }

      // 对于其他错误，返回基础信息而不是抛出错误
      try {
        const urlObj = new URL(url);
        return {
          domain: urlObj.hostname,
          title: urlObj.hostname,
          description: '无法提取页面内容',
        };
      } catch {
        return {};
      }
    }
  }

  /**
   * 解析HTML内容
   */
  private parseHtmlContent(html: string, urlObj: URL): WebContentExtraction {
    // 简单的 HTML 解析提取标题和描述
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descriptionMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    const faviconMatch = html.match(
      /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i
    );

    // 提取纯文本内容（简化版）
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const wordCount = textContent.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // 假设每分钟200字

    return {
      title: titleMatch?.[1]?.trim()?.substring(0, 200), // 限制标题长度
      description: descriptionMatch?.[1]?.trim()?.substring(0, 500), // 限制描述长度
      content: textContent.substring(0, 5000), // 限制内容长度
      favicon: faviconMatch?.[1]
        ? this.resolveUrl(faviconMatch[1], urlObj.href)
        : undefined,
      domain: urlObj.hostname,
      language: this.detectLanguage(textContent),
      wordCount,
      readingTime,
    };
  }

  /**
   * 解析相对 URL
   */
  private resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  /**
   * 简单的语言检测
   */
  private detectLanguage(text: string): string {
    // 简化的语言检测逻辑
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalChars = text.length;

    if (chineseChars / totalChars > 0.3) {
      return 'zh';
    }
    return 'en';
  }
}
