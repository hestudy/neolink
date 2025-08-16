import { Hono } from 'hono';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  getValidatedData,
} from '../middleware/validation';
import {
  CreateBookmarkSchema,
  UpdateBookmarkSchema,
  ListBookmarksSchema,
  UUIDSchema,
} from '@neolink/shared';

/**
 * 示例路由 - 展示验证系统的使用
 */
export const examplesRoute = new Hono();

// 参数验证示例
const BookmarkParamsSchema = z.object({
  id: UUIDSchema,
});

// 创建书签示例
examplesRoute.post(
  '/bookmarks',
  validateBody(CreateBookmarkSchema),
  async (c) => {
    const validatedBody = getValidatedData(c, 'body');

    // 这里 validatedBody 已经是类型安全的 CreateBookmark 类型
    return c.json({
      success: true,
      message: '书签创建成功',
      data: {
        id: crypto.randomUUID(),
        ...validatedBody,
        userId: 'current-user-id', // 从认证中间件获取
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
);

// 获取书签列表示例
examplesRoute.get(
  '/bookmarks',
  validateQuery(ListBookmarksSchema),
  async (c) => {
    const validatedQuery = getValidatedData(c, 'query');

    // validatedQuery 包含验证和转换后的查询参数
    return c.json({
      success: true,
      data: {
        bookmarks: [], // 实际数据会从数据库获取
        pagination: {
          page: validatedQuery.page,
          limit: validatedQuery.limit,
          total: 0,
          totalPages: 0,
        },
        filters: {
          search: validatedQuery.search,
          tags: validatedQuery.tags,
          folderId: validatedQuery.folderId,
          isArchived: validatedQuery.isArchived,
        },
      },
    });
  }
);

// 获取单个书签示例
examplesRoute.get(
  '/bookmarks/:id',
  validateParams(BookmarkParamsSchema),
  async (c) => {
    const validatedParams = getValidatedData(c, 'params');

    // validatedParams.id 已经验证为有效的 UUID
    return c.json({
      success: true,
      data: {
        id: validatedParams.id,
        url: 'https://example.com',
        title: '示例书签',
        description: '这是一个示例书签',
        userId: 'current-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
);

// 更新书签示例
examplesRoute.put(
  '/bookmarks/:id',
  validateParams(BookmarkParamsSchema),
  validateBody(UpdateBookmarkSchema),
  async (c) => {
    const validatedParams = getValidatedData(c, 'params');
    const validatedBody = getValidatedData(c, 'body');

    return c.json({
      success: true,
      message: '书签更新成功',
      data: {
        id: validatedParams.id,
        ...validatedBody,
        updatedAt: new Date(),
      },
    });
  }
);

// 复杂验证示例 - 批量操作
const BatchOperationSchema = z
  .object({
    action: z.enum(['archive', 'unarchive', 'delete', 'move']),
    bookmarkIds: z
      .array(UUIDSchema)
      .min(1, '至少选择一个书签')
      .max(100, '一次最多操作100个书签'),
    targetFolderId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      // 如果是移动操作，必须提供目标文件夹
      if (data.action === 'move') {
        return data.targetFolderId !== undefined;
      }
      return true;
    },
    {
      message: '移动操作需要指定目标文件夹',
      path: ['targetFolderId'],
    }
  );

examplesRoute.post(
  '/bookmarks/batch',
  validateBody(BatchOperationSchema),
  async (c) => {
    const validatedBody = getValidatedData(c, 'body');

    return c.json({
      success: true,
      message: `批量${validatedBody.action}操作完成`,
      data: {
        action: validatedBody.action,
        processedCount: validatedBody.bookmarkIds.length,
        targetFolderId: validatedBody.targetFolderId,
      },
    });
  }
);

// 条件验证示例
const ConditionalSchema = z
  .object({
    type: z.enum(['url', 'note']),
    url: z.string().url().optional(),
    content: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'url') {
        return data.url !== undefined;
      }
      if (data.type === 'note') {
        return data.content !== undefined;
      }
      return true;
    },
    {
      message: 'URL类型需要提供url字段，笔记类型需要提供content字段',
    }
  );

examplesRoute.post('/items', validateBody(ConditionalSchema), async (c) => {
  const validatedBody = getValidatedData(c, 'body');

  return c.json({
    success: true,
    message: '项目创建成功',
    data: {
      id: crypto.randomUUID(),
      ...validatedBody,
      createdAt: new Date(),
    },
  });
});

// 验证错误处理示例
examplesRoute.post('/validation-demo', async (c) => {
  try {
    const body = await c.req.json();

    // 手动验证示例
    const schema = z
      .object({
        email: z.string().email('请输入有效的邮箱地址'),
        password: z.string().min(8, '密码至少需要8个字符'),
        confirmPassword: z.string(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: '密码和确认密码不匹配',
        path: ['confirmPassword'],
      });

    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: 'Validation Error',
          message: '输入数据验证失败',
          details: result.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
        400
      );
    }

    return c.json({
      success: true,
      message: '验证通过',
      data: result.data,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: 'Invalid JSON',
        message: '请求体格式错误',
      },
      400
    );
  }
});
