import { createOpenAPIApp } from './openapi/config';
import { setupMiddleware } from './middleware';
import { setupRoutes } from './routes';
import { setupErrorHandlers } from './middleware/errorHandler';
import { setupOpenAPIRoutes } from './openapi/setup';

const app = createOpenAPIApp();

// 设置中间件栈
setupMiddleware(app);

// 设置 OpenAPI 路由
setupOpenAPIRoutes(app);

// 设置路由
setupRoutes(app);

// 设置错误处理
setupErrorHandlers(app);

// 根路径和其他系统路由现在由 OpenAPI 路由处理

const port = parseInt(process.env.API_PORT || process.env.PORT || '8000');
const host = process.env.API_HOST || '0.0.0.0';

console.log(`🚀 NeoLink API Server starting on ${host}:${port}`);
console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

// 启动服务器
import { serve } from '@hono/node-server';

serve(
  {
    fetch: app.fetch,
    port,
    hostname: host,
  },
  (info) => {
    console.log(`✅ Server is running on http://${info.address}:${info.port}`);
  }
);

export default app;
