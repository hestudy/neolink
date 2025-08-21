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

// New types for enhanced content extraction

export interface ReadableContent {
  title: string;
  byline: string;
  content: string;
  textContent: string;
  excerpt: string;
  siteName: string;
  language: LanguageInfo;
  length: number;
  structuredData: StructuredData;
  extractedAt: Date;
}

export interface LanguageInfo {
  code: string;
  name: string;
  confidence: number;
}

export interface StructuredData {
  headings: Heading[];
  lists: List[];
  tables: Table[];
  images: Image[];
}

export interface Heading {
  level: number;
  text: string;
}

export interface List {
  type: 'ul' | 'ol';
  items: string[];
}

export interface Table {
  rows: string[][];
}

export interface Image {
  src: string;
  alt: string;
}

export interface OptimizedContent {
  content: string;
  truncated: boolean;
  originalLength: number;
  optimizedLength: number;
  preservedElements: {
    title: string;
    headings: Heading[];
    importantParagraphs: string[];
  };
  truncationRatio?: number;
}

export interface EnhancedMetadata {
  basic: {
    title: string;
    description: string;
    author: string;
    keywords: string;
  };
  structuredData: Record<string, unknown>[];
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
  };
  twitterCard: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
  };
  timeInfo: {
    published?: string;
    modified?: string;
  };
}

export enum ExtractionErrorCode {
  READABILITY_FAILED = 'READABILITY_FAILED',
  HTML_PARSE_FAILED = 'HTML_PARSE_FAILED',
  CONTENT_TOO_SHORT = 'CONTENT_TOO_SHORT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  LANGUAGE_DETECTION_FAILED = 'LANGUAGE_DETECTION_FAILED',
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: ExtractionErrorCode,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

// AI Summary Generation Job Types

export interface SummaryGenerationJob {
  id: string;
  bookmarkId: string;
  content: string;
  language: string;
  userId: string;
  options: {
    summaryLength: 'short' | 'medium' | 'long';
    maxLength?: number;
    provider?: 'openai' | 'claude';
  };
  status: JobStatus;
  result?: SummaryGenerationResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
}

export interface SummaryGenerationResult {
  summary: string;
  confidence: number;
  language: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
  provider: string;
  generatedAt: Date;
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export class SummaryGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SummaryGenerationError';
  }
}
