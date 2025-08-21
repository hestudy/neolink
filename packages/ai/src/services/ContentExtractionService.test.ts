import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ContentExtractionService } from './ContentExtractionService';
import { ContentExtractionOptions } from '@neolink/shared/types/content';

// Mock Puppeteer
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

// Mock ReadabilityService
vi.mock('./ReadabilityService', () => ({
  ReadabilityService: vi.fn().mockImplementation(() => ({
    extractArticleContent: vi.fn().mockResolvedValue({
      title: 'Test Page', // Match the expected title in tests
      byline: 'Test Author',
      content: '<p>Test content</p>',
      textContent: 'Test content',
      excerpt: 'Test description',
      siteName: 'Test Site',
      language: { code: 'en', name: 'English', confidence: 0.9 },
      length: 100,
      structuredData: {
        headings: [],
        lists: [],
        tables: [],
        images: [],
      },
      extractedAt: expect.any(Date),
    }),
  })),
}));

// Mock MetadataExtractionService
vi.mock('./MetadataExtractionService', () => ({
  MetadataExtractionService: vi.fn().mockImplementation(() => ({
    extractEnhancedMetadata: vi.fn().mockResolvedValue({
      basic: {
        title: 'Test Page',
        description: 'Test description',
        author: 'Test Author',
        keywords: 'test, keywords',
      },
      openGraph: {
        title: 'OG Title',
        description: 'OG Description',
        image: 'https://example.com/image.jpg',
        url: 'https://example.com',
        type: 'article',
        siteName: 'Test Site',
      },
      twitterCard: {
        card: 'summary',
        title: 'Twitter Title',
        description: 'Twitter Description',
        image: 'https://example.com/twitter-image.jpg',
      },
      structuredData: [],
      timeInfo: {
        published: '2023-01-01T00:00:00Z',
        modified: '2023-01-02T00:00:00Z',
      },
    }),
  })),
}));

// Mock fetch for fallback tests
global.fetch = vi.fn();

interface MockPage {
  setViewport: Mock;
  setUserAgent: Mock;
  setDefaultTimeout: Mock;
  setDefaultNavigationTimeout: Mock;
  setRequestInterception: Mock;
  on: Mock;
  goto: Mock;
  evaluate: Mock;
  content: Mock;
  screenshot: Mock;
  close: Mock;
}

interface MockBrowser {
  newPage: Mock;
  isConnected: Mock;
  close: Mock;
}

describe('ContentExtractionService', () => {
  let service: ContentExtractionService;
  let mockBrowser: MockBrowser;
  let mockPage: MockPage;
  let mockLaunch: Mock;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mock function reference
    const puppeteer = await import('puppeteer');
    mockLaunch = puppeteer.default.launch as Mock;

    // Setup mock browser and page
    mockPage = {
      setViewport: vi.fn(),
      setUserAgent: vi.fn(),
      setDefaultTimeout: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
      setRequestInterception: vi.fn(),
      on: vi.fn(),
      goto: vi.fn(),
      evaluate: vi.fn(),
      content: vi
        .fn()
        .mockResolvedValue(
          '<html><head><title>Test</title></head><body><p>Test content</p></body></html>'
        ),
      screenshot: vi.fn(),
      close: vi.fn(),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      isConnected: vi.fn().mockReturnValue(true),
      close: vi.fn(),
    };

    mockLaunch.mockResolvedValue(mockBrowser);

    service = new ContentExtractionService();
  });

  afterEach(async () => {
    await service.close();
  });

  describe('extractContent', () => {
    it('should successfully extract content from a valid URL', async () => {
      const testUrl = 'https://example.com';
      const mockBasicInfo = {
        title: 'Test Page',
        description: 'Test description',
        favicon: '/favicon.ico',
        author: 'Test Author',
      };

      mockPage.evaluate
        .mockResolvedValueOnce(mockBasicInfo) // Basic info extraction
        .mockResolvedValueOnce('<p>Test content</p>'); // Content extraction

      mockPage.screenshot.mockResolvedValue('base64screenshot');

      const result = await service.extractContent(testUrl, {
        includeScreenshot: true,
        includeContent: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.title).toBe('Test Page');
      expect(result.data!.description).toBe('Test description');
      expect(result.data!.url).toBe(testUrl);
      expect(result.data!.screenshot).toBe(
        'data:image/png;base64,base64screenshot'
      );
      expect(result.extractionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid URLs', async () => {
      const invalidUrl = 'not-a-url';

      const result = await service.extractContent(invalidUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should handle navigation timeout', async () => {
      const testUrl = 'https://example.com';
      const timeoutError = new Error('Navigation timeout of 30000 ms exceeded');
      timeoutError.message = 'timeout';

      mockPage.goto.mockRejectedValue(timeoutError);

      // Mock fallback fetch
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<title>Fallback Title</title>'),
      });

      const result = await service.extractContent(testUrl);

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.data!.title).toBe('Fallback Title');
    });

    it('should use fallback extraction when browser fails', async () => {
      const testUrl = 'https://example.com';

      mockPage.goto.mockRejectedValue(new Error('Browser error'));

      // Mock successful fallback
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<title>Fallback Title</title><meta name="description" content="Fallback description">'
          ),
      });

      const result = await service.extractContent(testUrl);

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.data!.title).toBe('Fallback Title');
      expect(result.data!.description).toBe('Fallback description');
    });

    it('should handle complete failure', async () => {
      const testUrl = 'https://example.com';

      mockPage.goto.mockRejectedValue(new Error('Browser error'));
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.extractContent(testUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect custom options', async () => {
      const testUrl = 'https://example.com';
      const options: ContentExtractionOptions = {
        timeout: 15000,
        userAgent: 'Custom User Agent',
        includeScreenshot: false,
        includeContent: false,
      };

      mockPage.evaluate.mockResolvedValue({
        title: 'Test Page',
        description: 'Test description',
        favicon: '/favicon.ico',
        author: 'Test Author',
      });

      const result = await service.extractContent(testUrl, options);

      expect(mockPage.setUserAgent).toHaveBeenCalledWith('Custom User Agent');
      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(15000);
      expect(mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(15000);
      expect(result.success).toBe(true);
      expect(result.data!.screenshot).toBe('');
      expect(result.data!.content).toBe('');
    });
  });

  describe('browser management', () => {
    it('should create browser instance when needed', async () => {
      const testUrl = 'https://example.com';

      mockPage.evaluate.mockResolvedValue({
        title: 'Test',
        description: '',
        favicon: '',
        author: '',
      });

      await service.extractContent(testUrl);

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining([
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ]),
        })
      );
    });

    it('should reuse existing browser instance', async () => {
      const testUrl = 'https://example.com';

      mockPage.evaluate.mockResolvedValue({
        title: 'Test',
        description: '',
        favicon: '',
        author: '',
      });

      // First extraction
      await service.extractContent(testUrl);

      // Second extraction
      await service.extractContent(testUrl);

      expect(mockLaunch).toHaveBeenCalledTimes(1);
    });

    it('should handle browser launch failure', async () => {
      const testUrl = 'https://example.com';

      mockLaunch.mockRejectedValue(new Error('Browser launch failed'));

      const result = await service.extractContent(testUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to launch browser');
    });
  });

  describe('isReady', () => {
    it('should return true when browser is connected', async () => {
      const isReady = await service.isReady();
      expect(isReady).toBe(true);
    });

    it('should return false when browser launch fails', async () => {
      mockLaunch.mockRejectedValue(new Error('Launch failed'));

      const isReady = await service.isReady();
      expect(isReady).toBe(false);
    });
  });

  describe('close', () => {
    it('should close browser properly', async () => {
      // Initialize browser
      await service.isReady();

      await service.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      // Initialize browser
      await service.isReady();

      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(service.close()).resolves.toBeUndefined();
    });
  });

  describe('URL validation', () => {
    it('should accept valid HTTP URLs', async () => {
      mockPage.evaluate.mockResolvedValue({
        title: 'Test',
        description: '',
        favicon: '',
        author: '',
      });

      const result = await service.extractContent('http://example.com');
      expect(result.success).toBe(true);
    });

    it('should accept valid HTTPS URLs', async () => {
      mockPage.evaluate.mockResolvedValue({
        title: 'Test',
        description: '',
        favicon: '',
        author: '',
      });

      const result = await service.extractContent('https://example.com');
      expect(result.success).toBe(true);
    });

    it('should reject non-HTTP protocols', async () => {
      const result = await service.extractContent('ftp://example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });
});
