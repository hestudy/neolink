import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Job } from 'bullmq';
import {
  ContentExtractionWorker,
  ContentExtractionJobData,
} from './contentExtractionWorker';

// Mock dependencies
vi.mock('@neolink/ai/services/ContentExtractionAdapter');
vi.mock('../repositories/ProcessingJobRepository');
vi.mock('../services/bookmark');
vi.mock('@neolink/database/connection');
vi.mock('drizzle-orm');

// Mock BullMQ Job
const createMockJob = (
  data: ContentExtractionJobData
): Partial<Job<ContentExtractionJobData>> => ({
  id: 'test-job-id',
  data,
  updateProgress: vi.fn(),
});

describe('ContentExtractionWorker', () => {
  let worker: ContentExtractionWorker;
  let mockJob: Partial<Job<ContentExtractionJobData>>;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = new ContentExtractionWorker();

    mockJob = createMockJob({
      bookmarkId: 'test-bookmark-id',
      url: 'https://example.com',
      userId: 'test-user-id',
      options: {
        enableScreenshots: true,
        enableFullContent: true,
        timeout: 30000,
      },
    });
  });

  describe('process', () => {
    it('should process content extraction job successfully', async () => {
      // Mock successful content extraction
      const mockExtractedContent = {
        title: 'Test Page',
        description: 'Test description',
        content: 'Test content',
        favicon: 'https://example.com/favicon.ico',
        domain: 'example.com',
        language: 'en',
        wordCount: 100,
        readingTime: 1,
      };

      // Mock ContentExtractionAdapter
      const mockContentExtractor = {
        extractContent: vi.fn().mockResolvedValue(mockExtractedContent),
      };
      (
        worker as unknown as { contentExtractor: typeof mockContentExtractor }
      ).contentExtractor = mockContentExtractor;

      // Mock repository methods
      const { processingJobRepository } = await import(
        '../repositories/ProcessingJobRepository'
      );
      const { db } = await import('@neolink/database/connection');

      vi.mocked(processingJobRepository.updateStatus).mockResolvedValue(null);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'test-bookmark-id',
                url: 'https://example.com',
                title: 'Test',
                userId: 'test-user-id',
              },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as unknown as ReturnType<typeof db.update>);

      const result = await worker.process(
        mockJob as Job<ContentExtractionJobData>
      );

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Page');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(mockJob.updateProgress).toHaveBeenCalledTimes(7);
      expect(processingJobRepository.updateStatus).toHaveBeenCalledWith(
        'test-job-id',
        'processing',
        expect.any(Object)
      );
      expect(processingJobRepository.updateStatus).toHaveBeenCalledWith(
        'test-job-id',
        'completed',
        expect.any(Object)
      );
    });

    it('should handle content extraction failure', async () => {
      // Mock failed content extraction
      const mockError = new Error('Content extraction failed');
      const mockContentExtractor = {
        extractContent: vi.fn().mockRejectedValue(mockError),
      };
      (
        worker as unknown as { contentExtractor: typeof mockContentExtractor }
      ).contentExtractor = mockContentExtractor;

      // Mock repository methods
      const { processingJobRepository } = await import(
        '../repositories/ProcessingJobRepository'
      );
      const { bookmarkService } = await import('../services/bookmark');

      vi.mocked(processingJobRepository.updateStatus).mockResolvedValue(null);
      vi.mocked(bookmarkService.findById).mockResolvedValue({
        id: 'test-bookmark-id',
        url: 'https://example.com',
        title: 'Test',
        userId: 'test-user-id',
      } as unknown as Awaited<ReturnType<typeof bookmarkService.findById>>);
      vi.mocked(bookmarkService.update).mockResolvedValue(null);

      await expect(
        worker.process(mockJob as Job<ContentExtractionJobData>)
      ).rejects.toThrow('Content extraction failed');

      expect(processingJobRepository.updateStatus).toHaveBeenCalledWith(
        'test-job-id',
        'failed',
        expect.objectContaining({
          error: 'Content extraction failed',
        })
      );
    });

    it('should handle missing bookmark', async () => {
      // Mock repository methods
      const { processingJobRepository } = await import(
        '../repositories/ProcessingJobRepository'
      );
      const { db } = await import('@neolink/database/connection');

      vi.mocked(processingJobRepository.updateStatus).mockResolvedValue(null);

      // Mock database query to return empty array (no bookmark found)
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]), // Empty array = no bookmark found
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      await expect(
        worker.process(mockJob as Job<ContentExtractionJobData>)
      ).rejects.toThrow('Bookmark test-bookmark-id not found');
    });
  });

  describe('onFailed', () => {
    it('should handle job failure correctly', async () => {
      const mockError = new Error('Job failed');

      // Mock repository methods
      const { processingJobRepository } = await import(
        '../repositories/ProcessingJobRepository'
      );
      const { bookmarkService } = await import('../services/bookmark');

      vi.mocked(processingJobRepository.incrementAttempts).mockResolvedValue(
        null
      );
      vi.mocked(processingJobRepository.findById).mockResolvedValue({
        id: 'test-job-id',
        attempts: 3,
        maxAttempts: 3,
      } as unknown as Awaited<
        ReturnType<typeof processingJobRepository.findById>
      >);
      vi.mocked(processingJobRepository.updateStatus).mockResolvedValue(null);
      vi.mocked(bookmarkService.update).mockResolvedValue(null);

      await worker.onFailed(
        mockJob as Job<ContentExtractionJobData>,
        mockError
      );

      expect(processingJobRepository.incrementAttempts).toHaveBeenCalledWith(
        'test-job-id'
      );
      expect(processingJobRepository.updateStatus).toHaveBeenCalledWith(
        'test-job-id',
        'failed',
        expect.objectContaining({
          error: expect.stringContaining('Max attempts (3) exceeded'),
        })
      );
    });
  });

  describe('onCompleted', () => {
    it('should handle job completion correctly', async () => {
      const mockResult = {
        title: 'Test Page',
        processingTime: 1000,
        wordCount: 100,
        extractedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await worker.onCompleted(
        mockJob as Job<ContentExtractionJobData>,
        mockResult as unknown as ContentExtractionWorker
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Content extraction job test-job-id completed successfully'
        )
      );

      consoleSpy.mockRestore();
    });
  });

  describe('onProgress', () => {
    it('should handle progress updates correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await worker.onProgress(mockJob as Job<ContentExtractionJobData>, 50);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Content extraction job test-job-id progress: 50%'
        )
      );

      consoleSpy.mockRestore();
    });
  });

  describe('onStalled', () => {
    it('should handle stalled jobs correctly', async () => {
      const { processingJobRepository } = await import(
        '../repositories/ProcessingJobRepository'
      );
      vi.mocked(processingJobRepository.updateStatus).mockResolvedValue(null);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await worker.onStalled(mockJob as Job<ContentExtractionJobData>);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Content extraction job test-job-id stalled')
      );
      expect(processingJobRepository.updateStatus).toHaveBeenCalledWith(
        'test-job-id',
        'pending',
        undefined
      );

      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources correctly', async () => {
      const mockContentExtractor = {
        close: vi.fn().mockResolvedValue(undefined),
      };
      (
        worker as unknown as { contentExtractor: typeof mockContentExtractor }
      ).contentExtractor = mockContentExtractor;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await worker.cleanup();

      expect(mockContentExtractor.close).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Content extraction worker cleaned up')
      );

      consoleSpy.mockRestore();
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockError = new Error('Cleanup failed');
      const mockContentExtractor = {
        close: vi.fn().mockRejectedValue(mockError),
      };
      (
        worker as unknown as { contentExtractor: typeof mockContentExtractor }
      ).contentExtractor = mockContentExtractor;

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await worker.cleanup();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error cleaning up content extraction worker'),
        mockError
      );

      consoleSpy.mockRestore();
    });
  });
});
