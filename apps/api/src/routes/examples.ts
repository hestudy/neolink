import { Hono } from 'hono';

export const examplesRoute = new Hono();

// GET /examples - 获取示例列表
examplesRoute.get('/', async (c) => {
  return c.json({
    success: true,
    data: {
      examples: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Example 1',
          description: 'This is an example',
          tags: ['demo', 'test'],
          priority: 'medium',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    },
    requestId: c.get('requestId') || 'unknown',
  });
});

// GET /examples/validation-demo - 验证中间件演示端点
examplesRoute.get('/validation-demo', async (c) => {
  return c.json({
    success: true,
    message: 'This endpoint demonstrates various validation patterns',
    examples: {
      'GET /examples': 'Simple example endpoint',
      'GET /examples/validation-demo': 'Validation demonstration endpoint',
    },
    requestId: c.get('requestId') || 'unknown',
  });
});
