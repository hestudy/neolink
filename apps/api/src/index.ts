import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { healthRoute } from './routes/health';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// 路由
app.route('/health', healthRoute);

// 根路径
app.get('/', (c) => {
  return c.json({
    message: 'NeoLink API Server',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// 404 处理
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not Found',
      message: 'The requested resource was not found',
    },
    404
  );
});

// 错误处理
app.onError((err, c) => {
  console.error('Server Error:', err);
  return c.json(
    {
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    },
    500
  );
});

const port = parseInt(process.env.PORT || '8000');

console.log(`🚀 NeoLink API Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
