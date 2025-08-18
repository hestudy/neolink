/**
 * Content extraction types and interfaces
 */

export interface ExtractedContent {
  url: string;
  title: string;
  description: string;
  favicon: string;
  author: string;
  content: string;
  textContent: string;
  screenshot: string;
  extractedAt: Date;
}

export interface BasicPageInfo {
  title: string;
  description: string;
  favicon: string;
  author: string;
}

export interface ContentExtractionOptions {
  includeScreenshot?: boolean;
  includeContent?: boolean;
  screenshotOptions?: {
    type?: 'png' | 'jpeg';
    quality?: number;
    fullPage?: boolean;
  };
  timeout?: number;
  userAgent?: string;
}

export interface ContentExtractionResult {
  success: boolean;
  data?: ExtractedContent;
  error?: string;
  fallbackUsed?: boolean;
  extractionTime?: number;
}

export enum ExtractionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  FALLBACK_USED = 'fallback_used',
}

export interface ExtractionJob {
  id: string;
  url: string;
  status: ExtractionStatus;
  options: ContentExtractionOptions;
  result?: ExtractedContent;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
}

export class ContentExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ContentExtractionError';
  }
}

export class TimeoutError extends ContentExtractionError {
  constructor(timeout: number, originalError?: Error) {
    super(
      `Content extraction timed out after ${timeout}ms`,
      'TIMEOUT',
      originalError
    );
  }
}

export class NetworkError extends ContentExtractionError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', originalError);
  }
}

export class BrowserError extends ContentExtractionError {
  constructor(message: string, originalError?: Error) {
    super(message, 'BROWSER_ERROR', originalError);
  }
}
