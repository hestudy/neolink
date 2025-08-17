import { Context, Next } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';

/**
 * 验证中间件工厂
 */
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        throw new HTTPException(400, {
          message: 'Validation Error',
        });
      }

      // 将验证后的数据设置到上下文
      c.set('body', result.data);
      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      throw new HTTPException(400, {
        message: '无效的JSON格式',
      });
    }
  };
}

/**
 * 验证查询参数
 */
export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    // 获取所有查询参数
    const queryObj: Record<string, any> = {};
    const url = new URL(c.req.url);

    for (const [key, value] of url.searchParams.entries()) {
      if (queryObj[key]) {
        // 如果已存在，转换为数组
        if (Array.isArray(queryObj[key])) {
          queryObj[key].push(value);
        } else {
          queryObj[key] = [queryObj[key], value];
        }
      } else {
        // 尝试类型转换
        if (value === 'true') {
          queryObj[key] = true;
        } else if (value === 'false') {
          queryObj[key] = false;
        } else if (/^\d+$/.test(value)) {
          queryObj[key] = parseInt(value, 10);
        } else if (/^\d*\.\d+$/.test(value)) {
          queryObj[key] = parseFloat(value);
        } else if (value.includes(',')) {
          // 处理逗号分隔的数组
          queryObj[key] = value.split(',');
        } else {
          queryObj[key] = value;
        }
      }
    }

    const result = schema.safeParse(queryObj);

    if (!result.success) {
      throw new HTTPException(400, {
        message: 'Validation Error',
      });
    }

    c.set('query', result.data);
    await next();
  };
}

/**
 * 验证路径参数
 */
export function validateParams<T extends z.ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    const params = c.req.param();
    const result = schema.safeParse(params);

    if (!result.success) {
      throw new HTTPException(400, {
        message: 'Validation Error',
      });
    }

    c.set('params', result.data);
    await next();
  };
}

/**
 * 通用验证函数
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new HTTPException(400, {
      message: 'Validation failed',
    });
  }

  return result.data;
}

/**
 * 常用的验证 schema
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format');
export const EmailSchema = z.string().email('Invalid email format');
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');

/**
 * 分页参数验证
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * 搜索参数验证
 */
export const SearchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  fields: z.string().optional(),
  filters: z.string().optional(),
});

/**
 * 获取验证后的数据
 */
export function getValidatedData<T>(c: Context, key: string): T {
  return c.get(key) as T;
}

/**
 * 验证数据（同步版本）
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      data: undefined,
      errors: formatZodError(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
    errors: undefined,
  };
}

/**
 * 格式化 Zod 错误
 */
export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}
