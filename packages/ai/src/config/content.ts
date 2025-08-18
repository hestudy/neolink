/**
 * Content extraction configuration
 */

export interface ContentConfig {
  userAgent: string;
  timeout: number;
  viewport: { width: number; height: number };
  puppeteerOptions: {
    headless: boolean;
    args: string[];
  };
  retryAttempts: number;
  screenshotOptions: {
    type: 'png' | 'jpeg';
    quality?: number;
    fullPage: boolean;
  };
}

export const defaultContentConfig: ContentConfig = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 30000, // 30 seconds
  viewport: {
    width: 1200,
    height: 800,
  },
  puppeteerOptions: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ],
  },
  retryAttempts: 1,
  screenshotOptions: {
    type: 'png',
    fullPage: false,
  },
};

/**
 * Environment-specific configuration
 */
export function getContentConfig(): ContentConfig {
  const config = { ...defaultContentConfig };

  // Override with environment variables if available
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    (config.puppeteerOptions as Record<string, unknown>).executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (process.env.CONTENT_EXTRACTION_TIMEOUT) {
    config.timeout = parseInt(process.env.CONTENT_EXTRACTION_TIMEOUT, 10);
  }

  if (process.env.CONTENT_USER_AGENT) {
    config.userAgent = process.env.CONTENT_USER_AGENT;
  }

  return config;
}
