import { Hono } from 'hono';
import { healthRoute } from './health';
import { examplesRoute } from './examples';
import { authRoute } from './auth';
import { orpcHandler } from '../adapters/orpc';

/**
 * 设置所有路由
 */
export function setupRoutes(app: Hono) {
  // 健康检查路由
  app.route('/health', healthRoute);

  // API版本路由组
  const apiV1 = new Hono();

  // 认证路由
  apiV1.route('/auth', authRoute);

  // oRPC 路由 - 类型安全的API端点
  apiV1.route('/rpc', orpcHandler);

  // 验证示例路由
  apiV1.route('/examples', examplesRoute);

  // 将来在这里添加其他路由
  // apiV1.route('/bookmarks', bookmarksRoute);
  // apiV1.route('/search', searchRoute);
  // apiV1.route('/ai', aiRoute);
  // apiV1.route('/tags', tagsRoute);
  // apiV1.route('/data', dataRoute);
  // apiV1.route('/system', systemRoute);

  // 挂载API v1路由
  app.route('/api/v1', apiV1);

  console.log('✅ Routes configured with oRPC integration');
}
