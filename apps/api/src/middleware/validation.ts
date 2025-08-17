import { Context, Next } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';

/**
 * 验证中间件工厂
 */
export function validateBody(schema: any) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);
      
      if (!result.success) {
        throw new HTTPException(400, {
          message: 'Validation failed',
        });
      }
      
      // 将验证后的数据设置到上下文
      c.set('validatedBody', result.data);
      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      
      throw new HTTPException(400, {
        message: 'Invalid JSON body',
      });
    }
  };
}

/**
 * 验证查询参数
 */
export function validateQuery(schema: any) {
  return async (c: Context, next: Next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);
    
    if (!result.success) {
      throw new HTTPException(400, {
        message: 'Query validation failed',
      });
    }
    
    c.set('validatedQuery', result.data);
    await next();
  };
}

/**
 * 验证路径参数
 */
export function validateParams(schema: any) {
  return async (c: Context, next: Next) => {
    const params = c.req.param();
    const result = schema.safeParse(params);
    
    if (!result.success) {
      throw new HTTPException(400, {
        message: 'Path parameter validation failed',
      });
    }
    
    c.set('validatedParams', result.data);
    await next();
  };
}

/**
 * 通用验证函数
 */
export function validate<T>(schema: any, data: unknown): T {
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
export const PasswordSchema = z.string().min(8, 'Password must be at least 8 characters');

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
export function getValidatedData<T>(c: any, key: string): T {
  return c.get(key) as T;
}
