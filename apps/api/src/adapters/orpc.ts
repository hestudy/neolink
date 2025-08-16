import { Hono } from 'hono';
import { appRouter } from '@neolink/shared';

/**
 * oRPC 上下文类型定义
 */
export interface ORPCContext {
  // 用户信息（从JWT中解析）
  user?: {
    id: string;
    email: string;
    name?: string;
  };

  // 请求信息
  requestId: string;
  userAgent?: string;
  ip?: string;

  // 服务实例（将在后续任务中添加）
  // bookmarkService?: BookmarkService;
  // searchService?: SearchService;
  // tagService?: TagService;
  // systemService?: SystemService;
}

/**
 * 创建简化的 oRPC 处理器
 * 暂时返回一个基础的Hono应用，后续会完善oRPC集成
 */
export function createORPCHandler(): Hono {
  const app = new Hono();

  // 基础的oRPC端点处理
  app.all('/*', async (c) => {
    const method = c.req.method;
    const path = c.req.path;

    // 创建上下文
    const context: ORPCContext = {
      user: c.get('user'),
      requestId: c.get('requestId') || 'unknown',
      userAgent: c.req.header('user-agent'),
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    };

    // 暂时返回一个基础响应，表示oRPC已集成
    return c.json({
      success: true,
      message: 'oRPC endpoint ready',
      method,
      path,
      context: {
        requestId: context.requestId,
        hasUser: !!context.user,
      },
      router: 'appRouter integrated',
    });
  });

  return app;
}

/**
 * oRPC 处理器实例
 */
export const orpcHandler = createORPCHandler();

/**
 * oRPC 路由器类型（用于类型推断）
 */
export type ORPCRouter = typeof appRouter;
