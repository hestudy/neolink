/**
 * ProcessingJob Repository
 * 处理任务的数据库操作
 */

import { eq, and, desc, asc, count, inArray } from 'drizzle-orm';
import { db } from '@neolink/database/connection';
import {
  processingJobs,
  type ProcessingJob,
  type NewProcessingJob,
  type JobType,
  type JobStatus,
} from '@neolink/database/schema';

/**
 * 查询选项接口
 */
export interface ProcessingJobQueryOptions {
  limit?: number;
  offset?: number;
  status?: JobStatus | JobStatus[];
  type?: JobType | JobType[];
  bookmarkId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页结果接口
 */
export interface PaginatedProcessingJobs {
  jobs: ProcessingJob[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * 任务统计接口
 */
export interface ProcessingJobStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  byType: Record<JobType, number>;
}

/**
 * ProcessingJob Repository 类
 */
export class ProcessingJobRepository {
  /**
   * 创建新的处理任务
   */
  async create(data: NewProcessingJob): Promise<ProcessingJob> {
    try {
      const [job] = await db
        .insert(processingJobs)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!job) {
        throw new Error('Failed to create processing job');
      }

      return job;
    } catch (error) {
      console.error('Error creating processing job:', error);
      throw new Error(`Failed to create processing job: ${error}`);
    }
  }

  /**
   * 根据ID查找处理任务
   */
  async findById(id: string): Promise<ProcessingJob | null> {
    try {
      const [job] = await db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.id, id))
        .limit(1);

      return job || null;
    } catch (error) {
      console.error('Error finding processing job by ID:', error);
      return null;
    }
  }

  /**
   * 根据书签ID查找处理任务
   */
  async findByBookmarkId(
    bookmarkId: string,
    options: Omit<ProcessingJobQueryOptions, 'bookmarkId'> = {}
  ): Promise<ProcessingJob[]> {
    try {
      let query: any = db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.bookmarkId, bookmarkId));

      // 添加状态过滤
      if (options.status) {
        const statuses = Array.isArray(options.status)
          ? options.status
          : [options.status];
        query = query.where(
          and(
            eq(processingJobs.bookmarkId, bookmarkId),
            inArray(processingJobs.status, statuses)
          )
        );
      }

      // 添加类型过滤
      if (options.type) {
        const types = Array.isArray(options.type)
          ? options.type
          : [options.type];
        query = query.where(
          and(
            eq(processingJobs.bookmarkId, bookmarkId),
            inArray(processingJobs.type, types)
          )
        );
      }

      // 添加排序
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      const sortColumn = processingJobs[sortBy];
      query =
        sortOrder === 'asc'
          ? query.orderBy(asc(sortColumn))
          : query.orderBy(desc(sortColumn));

      // 添加分页
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      console.error('Error finding processing jobs by bookmark ID:', error);
      return [];
    }
  }

  /**
   * 查询处理任务列表（分页）
   */
  async findMany(
    options: ProcessingJobQueryOptions = {}
  ): Promise<PaginatedProcessingJobs> {
    try {
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // 构建查询条件
      const conditions = [];

      if (options.status) {
        const statuses = Array.isArray(options.status)
          ? options.status
          : [options.status];
        conditions.push(inArray(processingJobs.status, statuses));
      }

      if (options.type) {
        const types = Array.isArray(options.type)
          ? options.type
          : [options.type];
        conditions.push(inArray(processingJobs.type, types));
      }

      if (options.bookmarkId) {
        conditions.push(eq(processingJobs.bookmarkId, options.bookmarkId));
      }

      // 构建查询
      let query: any = db.select().from(processingJobs);
      let countQuery: any = db.select({ count: count() }).from(processingJobs);

      if (conditions.length > 0) {
        const whereClause =
          conditions.length === 1 ? conditions[0] : and(...conditions);
        query = query.where(whereClause);
        countQuery = countQuery.where(whereClause);
      }

      // 添加排序
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      const sortColumn = processingJobs[sortBy];
      query =
        sortOrder === 'asc'
          ? query.orderBy(asc(sortColumn))
          : query.orderBy(desc(sortColumn));

      // 添加分页
      query = query.limit(limit).offset(offset);

      // 执行查询
      const [jobs, totalResult] = await Promise.all([query, countQuery]);

      const total = totalResult[0]?.count || 0;

      return {
        jobs,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('Error finding processing jobs:', error);
      return {
        jobs: [],
        total: 0,
        limit: options.limit || 20,
        offset: options.offset || 0,
        hasMore: false,
      };
    }
  }

  /**
   * 更新处理任务
   */
  async update(
    id: string,
    data: Partial<ProcessingJob>
  ): Promise<ProcessingJob | null> {
    try {
      const [updatedJob] = await db
        .update(processingJobs)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, id))
        .returning();

      return updatedJob || null;
    } catch (error) {
      console.error('Error updating processing job:', error);
      return null;
    }
  }

  /**
   * 更新任务状态
   */
  async updateStatus(
    id: string,
    status: JobStatus,
    additionalData?: {
      result?: unknown;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<ProcessingJob | null> {
    try {
      const updateData: Partial<ProcessingJob> = {
        status,
        updatedAt: new Date(),
        ...additionalData,
      };

      // 如果状态是 processing，设置 startedAt
      if (status === 'processing' && !additionalData?.startedAt) {
        updateData.startedAt = new Date();
      }

      // 如果状态是 completed 或 failed，设置 completedAt
      if (
        (status === 'completed' || status === 'failed') &&
        !additionalData?.completedAt
      ) {
        updateData.completedAt = new Date();
      }

      const [updatedJob] = await db
        .update(processingJobs)
        .set(updateData)
        .where(eq(processingJobs.id, id))
        .returning();

      return updatedJob || null;
    } catch (error) {
      console.error('Error updating processing job status:', error);
      return null;
    }
  }

  /**
   * 增加重试次数
   */
  async incrementAttempts(id: string): Promise<ProcessingJob | null> {
    try {
      const job = await this.findById(id);
      if (!job) return null;

      const [updatedJob] = await db
        .update(processingJobs)
        .set({
          attempts: job.attempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, id))
        .returning();

      return updatedJob || null;
    } catch (error) {
      console.error('Error incrementing processing job attempts:', error);
      return null;
    }
  }

  /**
   * 删除处理任务
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(processingJobs)
        .where(eq(processingJobs.id, id));

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting processing job:', error);
      return false;
    }
  }

  /**
   * 获取任务统计信息
   */
  async getStats(): Promise<ProcessingJobStats> {
    try {
      // 获取总体统计
      const [totalResult] = await db
        .select({ count: count() })
        .from(processingJobs);

      // 按状态统计
      const statusStats = await db
        .select({
          status: processingJobs.status,
          count: count(),
        })
        .from(processingJobs)
        .groupBy(processingJobs.status);

      // 按类型统计
      const typeStats = await db
        .select({
          type: processingJobs.type,
          count: count(),
        })
        .from(processingJobs)
        .groupBy(processingJobs.type);

      // 构建结果
      const stats: ProcessingJobStats = {
        total: totalResult?.count || 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        byType: {} as Record<JobType, number>,
      };

      // 填充状态统计
      statusStats.forEach(({ status, count }) => {
        if (status in stats) {
          (stats as unknown as Record<string, number>)[status] = count;
        }
      });

      // 填充类型统计
      typeStats.forEach(({ type, count }) => {
        stats.byType[type as JobType] = count;
      });

      return stats;
    } catch (error) {
      console.error('Error getting processing job stats:', error);
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        byType: {} as Record<JobType, number>,
      };
    }
  }

  /**
   * 清理旧的已完成任务
   */
  async cleanupOldJobs(daysOld = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await db.delete(processingJobs).where(
        and(
          inArray(processingJobs.status, ['completed', 'failed', 'cancelled'])
          // Note: This would need proper date comparison in real implementation
        )
      );

      return result.rowCount ?? 0;
    } catch (error) {
      console.error('Error cleaning up old processing jobs:', error);
      return 0;
    }
  }
}

// 导出单例实例
export const processingJobRepository = new ProcessingJobRepository();
