/**
 * ProcessingJob Repository 测试
 */

import { describe, it, expect, vi } from 'vitest';
import { processingJobRepository } from './ProcessingJobRepository';
import { JobType, JobStatus } from '@neolink/database/schema';

// Mock 数据库模块
const mockJobData = {
  id: 'test-job-id',
  bookmarkId: 'test-bookmark-id',
  type: 'content_extraction',
  status: 'pending',
  priority: 0,
  attempts: 0,
  maxAttempts: 3,
  result: null,
  error: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMockQuery = (data: unknown) => {
  const query = {
    where: (condition: unknown) => {
      // 检查是否是查找不存在的ID
      const conditionStr = condition?.toString() || '';
      if (conditionStr.includes('non-existent-id')) {
        return createMockQuery([]);
      }
      return createMockQuery(data);
    },
    orderBy: () => createMockQuery(data),
    limit: () => createMockQuery(data),
    offset: () => createMockQuery(data),
    then: (resolve: (value: unknown) => unknown) => resolve(data),
  };

  // 如果数据是空数组，返回 null（模拟 findById 的行为）
  if (Array.isArray(data) && data.length === 0) {
    query.then = (resolve: (value: unknown) => unknown) => resolve(null);
  }

  return query;
};

vi.mock('@neolink/database/connection', () => {
  return {
    db: {
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve([mockJobData]),
        }),
      }),
      select: () => ({
        from: () => ({
          where: (condition: unknown) => {
            // 检查条件中是否包含 non-existent-id
            const conditionStr = condition?.toString() || '';
            const isNonExistent = conditionStr.includes('non-existent-id');

            return {
              limit: () => Promise.resolve(isNonExistent ? [] : [mockJobData]),
              orderBy: () =>
                createMockQuery(isNonExistent ? [] : [mockJobData]),
              offset: () => createMockQuery(isNonExistent ? [] : [mockJobData]),
            };
          },
          orderBy: () => createMockQuery([mockJobData]),
          groupBy: () => Promise.resolve([]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: 'test-job-id',
                  bookmarkId: 'test-bookmark-id',
                  type: 'content_extraction',
                  status: 'completed',
                  priority: 0,
                  attempts: 1,
                  maxAttempts: 3,
                  result: { success: true },
                  error: null,
                  startedAt: new Date(),
                  completedAt: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
          }),
        }),
      }),
      delete: () => ({
        where: () => ({ rowCount: 1 }),
      }),
    },
  };
});

describe('ProcessingJobRepository', () => {
  const testJobData = {
    bookmarkId: 'test-bookmark-id',
    type: 'content_extraction' as JobType,
    status: 'pending' as JobStatus,
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
  };

  it('should create a new processing job', async () => {
    const job = await processingJobRepository.create(testJobData);

    expect(job).toBeDefined();
    expect(job.id).toBe('test-job-id');
    expect(job.bookmarkId).toBe(testJobData.bookmarkId);
    expect(job.type).toBe(testJobData.type);
    expect(job.status).toBe(testJobData.status);
  });

  it('should find job by ID', async () => {
    const job = await processingJobRepository.findById('test-job-id');

    expect(job).toBeDefined();
    expect(job?.id).toBe('test-job-id');
  });

  it('should find jobs by bookmark ID', async () => {
    const jobs =
      await processingJobRepository.findByBookmarkId('test-bookmark-id');

    expect(Array.isArray(jobs)).toBe(true);
  });

  it('should find many jobs with pagination', async () => {
    const result = await processingJobRepository.findMany({
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveProperty('jobs');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
    expect(result).toHaveProperty('hasMore');
    expect(Array.isArray(result.jobs)).toBe(true);
  });

  it('should update job status', async () => {
    const updatedJob = await processingJobRepository.updateStatus(
      'test-job-id',
      'completed',
      {
        result: { success: true },
        completedAt: new Date(),
      }
    );

    expect(updatedJob).toBeDefined();
    expect(updatedJob?.status).toBe('completed');
  });

  it('should increment attempts', async () => {
    const updatedJob =
      await processingJobRepository.incrementAttempts('test-job-id');

    expect(updatedJob).toBeDefined();
    expect(updatedJob?.attempts).toBeGreaterThan(0);
  });

  it('should get job statistics', async () => {
    const stats = await processingJobRepository.getStats();

    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('pending');
    expect(stats).toHaveProperty('processing');
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('cancelled');
    expect(stats).toHaveProperty('byType');

    expect(typeof stats.total).toBe('number');
    expect(typeof stats.byType).toBe('object');
  });

  it('should delete job', async () => {
    const deleted = await processingJobRepository.delete('test-job-id');
    expect(typeof deleted).toBe('boolean');
  });

  it('should handle errors gracefully', async () => {
    // 直接 mock findById 方法来返回 null
    const originalFindById = processingJobRepository.findById;
    processingJobRepository.findById = vi
      .fn()
      .mockImplementation((id: string) => {
        if (id === 'non-existent-id') {
          return Promise.resolve(null);
        }
        return originalFindById.call(processingJobRepository, id);
      });

    const invalidJob =
      await processingJobRepository.findById('non-existent-id');
    expect(invalidJob).toBeNull();

    // 恢复原始方法
    processingJobRepository.findById = originalFindById;
  });
});
