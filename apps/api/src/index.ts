import { createOpenAPIApp } from './openapi/config';
import { setupMiddleware } from './middleware';
import { setupRoutes } from './routes';
import { setupErrorHandlers } from './middleware/errorHandler';
import { setupOpenAPIRoutes } from './openapi/setup';
import {
  initializeApp,
  setupGracefulShutdown,
} from './services/appInitializer';

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

// 设置优雅关闭处理器
setupGracefulShutdown();

// 异步启动函数
async function startServer() {
  try {
    // 初始化应用服务（Redis、任务队列等）
    await initializeApp();

    // 启动服务器
    const { serve } = await import('@hono/node-server');

    serve(
      {
        fetch: app.fetch,
        port,
        hostname: host,
      },
      (info) => {
        console.log(
          `✅ Server is running on http://${info.address}:${info.port}`
        );
        console.log(
          `🎯 API Documentation: http://${info.address}:${info.port}/docs`
        );
        console.log(
          `📊 Health Check: http://${info.address}:${info.port}/health`
        );
      }
    );
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();

export default app;
