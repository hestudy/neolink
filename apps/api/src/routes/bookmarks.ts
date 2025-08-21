import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { validateUUIDParam, UUIDSchema } from '../middleware/validation';
import { bookmarkService } from '../services/bookmark';
import {
  CreateBookmarkSchema,
  UpdateBookmarkSchema,
} from '@neolink/shared/schemas';
import { z } from 'zod';

// URL预览请求schema
const URLPreviewSchema = z.object({
  url: z.string().url('无效的URL格式'),
});

export const bookmarksRoute = new Hono();

// 所有书签路由都需要认证
bookmarksRoute.use('/*', authMiddleware());

/**
 * POST /bookmarks - 创建书签
 */
bookmarksRoute.post('/', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();

    // 先验证输入数据
    const validation = CreateBookmarkSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          details: validation.error.issues,
        },
        400
      );
    }

    const bookmark = await bookmarkService.create(user.id, validation.data);

    return c.json(
      {
        success: true,
        data: bookmark,
        message: '书签创建成功',
      },
      201
    );
  } catch (error) {
    console.error('Create bookmark error:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          details: error.issues,
        },
        400
      );
    }

    if (error instanceof Error && error.message.includes('已经存在')) {
      return c.json(
        {
          success: false,
          error: 'Duplicate URL',
          message: error.message,
        },
        409
      );
    }

    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '创建书签失败',
      },
      500
    );
  }
});

/**
 * GET /bookmarks - 获取书签列表
 */
bookmarksRoute.get('/', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // 解析查询参数
    const query = c.req.query();
    const params = {
      page: parseInt(query.page || '1'),
      limit: parseInt(query.limit || '20'),
      search: query.search,
      tags: query.tags ? query.tags.split(',') : undefined,
      isArchived: query.isArchived ? query.isArchived === 'true' : undefined,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    const result = await bookmarkService.list(user.id, params);

    return c.json({
      success: true,
      data: result.bookmarks,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('List bookmarks error:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          details: error.issues,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '获取书签列表失败',
      },
      500
    );
  }
});

/**
 * GET /bookmarks/:id - 获取单个书签
 */
bookmarksRoute.get('/:id', validateUUIDParam('id'), async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const bookmark = await bookmarkService.findById(user.id, id);
    if (!bookmark) {
      return c.json(
        {
          success: false,
          error: 'Not Found',
          message: '书签不存在',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: bookmark,
    });
  } catch (error) {
    console.error('Get bookmark error:', error);
    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '获取书签失败',
      },
      500
    );
  }
});

/**
 * PUT /bookmarks/:id - 更新书签
 */
bookmarksRoute.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    if (!id) {
      return c.json(
        {
          success: false,
          error: 'Bad Request',
          message: '书签 ID 不能为空',
        },
        400
      );
    }

    // 验证 UUID 格式
    const uuidValidation = UUIDSchema.safeParse(id);
    if (!uuidValidation.success) {
      return c.json(
        {
          success: false,
          error: 'Bad Request',
          message: '无效的书签 ID 格式',
        },
        400
      );
    }

    const body = await c.req.json();

    // 验证输入数据
    const validation = UpdateBookmarkSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          details: validation.error.issues,
        },
        400
      );
    }

    const updatedBookmark = await bookmarkService.update(
      user.id,
      id,
      validation.data
    );

    if (!updatedBookmark) {
      return c.json(
        {
          success: false,
          error: 'Not Found',
          message: '书签不存在',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: updatedBookmark,
      message: '书签更新成功',
    });
  } catch (error) {
    console.error('Update bookmark error:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          details: error.issues,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '更新书签失败',
      },
      500
    );
  }
});

/**
 * DELETE /bookmarks/:id - 删除书签（软删除）
 */
bookmarksRoute.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    if (!id) {
      return c.json(
        {
          success: false,
          error: 'Bad Request',
          message: '书签 ID 不能为空',
        },
        400
      );
    }

    // 验证 UUID 格式
    const uuidValidation = UUIDSchema.safeParse(id);
    if (!uuidValidation.success) {
      return c.json(
        {
          success: false,
          error: 'Bad Request',
          message: '无效的书签 ID 格式',
        },
        400
      );
    }

    const success = await bookmarkService.delete(user.id, id);
    if (!success) {
      return c.json(
        {
          success: false,
          error: 'Not Found',
          message: '书签不存在',
        },
        404
      );
    }

    return c.json({
      success: true,
      message: '书签删除成功',
    });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '删除书签失败',
      },
      500
    );
  }
});

/**
 * POST /bookmarks/:id/archive - 归档书签
 */
bookmarksRoute.post('/:id/archive', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    if (!id) {
      return c.json(
        {
          success: false,
          error: 'Bad Request',
          message: '书签 ID 不能为空',
        },
        400
      );
    }

    const updatedBookmark = await bookmarkService.update(user.id, id, {
      isArchived: true,
    });

    if (!updatedBookmark) {
      return c.json(
        {
          success: false,
          error: 'Not Found',
          message: '书签不存在',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: updatedBookmark,
      message: '书签已归档',
    });
  } catch (error) {
    console.error('Archive bookmark error:', error);
    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '归档书签失败',
      },
      500
    );
  }
});

/**
 * POST /bookmarks/:id/unarchive - 取消归档书签
 */
bookmarksRoute.post('/:id/unarchive', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    if (!id) {
      return c.json(
        {
          success: false,
          error: 'Bad Request',
          message: '书签 ID 不能为空',
        },
        400
      );
    }

    const updatedBookmark = await bookmarkService.update(user.id, id, {
      isArchived: false,
    });

    if (!updatedBookmark) {
      return c.json(
        {
          success: false,
          error: 'Not Found',
          message: '书签不存在',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: updatedBookmark,
      message: '书签已取消归档',
    });
  } catch (error) {
    console.error('Unarchive bookmark error:', error);
    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '取消归档书签失败',
      },
      500
    );
  }
});

/**
 * POST /bookmarks/preview - 获取URL预览信息
 */
bookmarksRoute.post('/preview', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();

    // 验证输入数据
    const validation = URLPreviewSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          details: validation.error.issues,
        },
        400
      );
    }

    const { url } = validation.data;

    try {
      // 简单的网页元数据提取
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'NeoLink-Bot/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // 简单的HTML解析提取标题和描述
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const descriptionMatch =
        html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
        ) ||
        html.match(
          /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i
        );

      const title = titleMatch
        ? titleMatch[1].trim()
        : `来自 ${new URL(url).hostname} 的页面`;
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';

      return c.json({
        success: true,
        data: {
          title,
          description,
          url,
          domain: new URL(url).hostname,
        },
        message: '网页信息提取成功',
      });
    } catch (fetchError) {
      console.error('URL fetch error:', fetchError);

      // 如果提取失败，返回基础信息
      const parsedUrl = new URL(url);
      return c.json({
        success: true,
        data: {
          title: `来自 ${parsedUrl.hostname} 的页面`,
          description: '',
          url,
          domain: parsedUrl.hostname,
        },
        message: '网页信息提取成功（使用默认信息）',
      });
    }
  } catch (error) {
    console.error('Preview error:', error);
    return c.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: '获取网页预览失败',
      },
      500
    );
  }
});
