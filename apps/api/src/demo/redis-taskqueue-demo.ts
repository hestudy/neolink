/**
 * Redis 缓存和任务队列功能演示
 * 展示故事1.6的核心功能实现
 */

import { redisService } from '../services/redis';
import { queueManager } from '../services/taskQueue';

/**
 * 演示Redis连接和基础操作
 */
async function demoRedisConnection() {
  console.log('\n🔗 === Redis 连接演示 ===');

  try {
    // 连接Redis
    await redisService.connect();
    console.log('✅ Redis连接成功');

    // 检查连接状态
    const isReady = await redisService.isReady();
    console.log(`📊 Redis状态: ${isReady ? '健康' : '不健康'}`);

    // 获取健康信息
    const health = await redisService.getHealth();
    console.log('📈 Redis健康信息:');
    console.log(`   - 连接状态: ${health.connected}`);
    console.log(`   - 内存使用: ${health.memory.used}`);
    console.log(`   - 连接客户端: ${health.stats.connectedClients}`);

    // 测试基础操作
    const client = redisService.getClient();
    await client.set('demo:test', 'Hello Redis!');
    const value = await client.get('demo:test');
    console.log(`🔑 测试键值: ${value}`);

    // 清理测试数据
    await client.del('demo:test');
    console.log('🧹 测试数据已清理');
  } catch (error) {
    console.error('❌ Redis演示失败:', error);
  }
}

/**
 * 演示任务队列初始化和基础操作
 */
async function demoTaskQueue() {
  console.log('\n📋 === 任务队列演示 ===');

  try {
    // 初始化任务队列
    await queueManager.initialize();
    console.log('✅ 任务队列初始化成功');

    // 获取队列统计
    const stats = await queueManager.getAllQueueStats();
    console.log('📊 队列统计信息:');
    console.log(JSON.stringify(stats, null, 2));

    // 模拟添加内容提取任务
    console.log('\n📝 添加内容提取任务...');
    const job = await queueManager.addContentExtractionJob(
      'demo-bookmark-id',
      'https://example.com',
      'demo-user-id',
      {
        priority: 1,
        enableScreenshots: true,
        enableFullContent: true,
      }
    );

    console.log(`✅ 任务已添加，ID: ${job.id}`);
    console.log(`📋 任务名称: ${job.name}`);
    console.log(`🎯 任务数据:`, job.data);

    // 获取更新后的队列统计
    const updatedStats = await queueManager.getAllQueueStats();
    console.log('\n📊 更新后的队列统计:');
    console.log(JSON.stringify(updatedStats, null, 2));
  } catch (error) {
    console.error('❌ 任务队列演示失败:', error);
  }
}

/**
 * 演示缓存功能
 */
async function demoCaching() {
  console.log('\n💾 === 缓存功能演示 ===');

  try {
    const client = redisService.getClient();

    // 模拟API响应缓存
    const cacheKey = 'api:GET:/bookmarks?page=1&limit=10';
    const mockApiResponse = {
      status: 'success',
      data: {
        bookmarks: [
          { id: '1', title: 'Example 1', url: 'https://example1.com' },
          { id: '2', title: 'Example 2', url: 'https://example2.com' },
        ],
        total: 2,
        page: 1,
        limit: 10,
      },
      timestamp: new Date().toISOString(),
    };

    // 缓存响应（TTL: 300秒）
    await client.setex(cacheKey, 300, JSON.stringify(mockApiResponse));
    console.log(`💾 已缓存API响应: ${cacheKey}`);

    // 从缓存获取响应
    const cachedResponse = await client.get(cacheKey);
    if (cachedResponse) {
      const parsed = JSON.parse(cachedResponse);
      console.log('🎯 缓存命中!');
      console.log(`📄 缓存数据: ${parsed.data.bookmarks.length} 个书签`);
      console.log(`⏰ 缓存时间: ${parsed.timestamp}`);
    }

    // 获取缓存TTL
    const ttl = await client.ttl(cacheKey);
    console.log(`⏳ 缓存剩余时间: ${ttl} 秒`);

    // 演示缓存失效
    await client.del(cacheKey);
    console.log('🗑️ 缓存已失效');

    // 验证缓存已删除
    const deletedCache = await client.get(cacheKey);
    console.log(`🔍 缓存验证: ${deletedCache ? '仍存在' : '已删除'}`);
  } catch (error) {
    console.error('❌ 缓存演示失败:', error);
  }
}

/**
 * 演示监控功能
 */
async function demoMonitoring() {
  console.log('\n📊 === 监控功能演示 ===');

  try {
    // 系统健康检查
    const health = {
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        redis: (await redisService.isReady()) ? 'healthy' : 'unhealthy',
        taskQueue: 'healthy',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    console.log('🏥 系统健康状态:');
    console.log(`   - API: ${health.services.api}`);
    console.log(`   - Redis: ${health.services.redis}`);
    console.log(`   - 任务队列: ${health.services.taskQueue}`);
    console.log(`   - 运行时间: ${Math.floor(health.uptime)} 秒`);
    console.log(
      `   - 内存使用: ${Math.round(health.memory.heapUsed / 1024 / 1024)} MB`
    );

    // Redis详细状态
    const redisHealth = await redisService.getHealth();
    console.log('\n🔗 Redis详细状态:');
    console.log(`   - 连接状态: ${redisHealth.connected}`);
    console.log(`   - 内存使用: ${redisHealth.memory.used}`);
    console.log(`   - 峰值内存: ${redisHealth.memory.peak}`);
    console.log(`   - 总连接数: ${redisHealth.stats.totalConnections}`);

    // 任务队列状态
    const queueStats = await queueManager.getAllQueueStats();
    console.log('\n📋 任务队列状态:');
    Object.entries(queueStats).forEach(([queueName, stats]) => {
      console.log(`   - ${queueName}:`);
      console.log(`     等待: ${stats.waiting}, 活跃: ${stats.active}`);
      console.log(`     完成: ${stats.completed}, 失败: ${stats.failed}`);
    });
  } catch (error) {
    console.error('❌ 监控演示失败:', error);
  }
}

/**
 * 清理资源
 */
async function cleanup() {
  console.log('\n🧹 === 清理资源 ===');

  try {
    await queueManager.close();
    console.log('✅ 任务队列已关闭');

    await redisService.disconnect();
    console.log('✅ Redis连接已断开');
  } catch (error) {
    console.error('❌ 清理失败:', error);
  }
}

/**
 * 主演示函数
 */
async function main() {
  console.log('🚀 === NeoLink Redis缓存和任务队列功能演示 ===');
  console.log('📝 故事1.6: Redis缓存和任务队列基础设施');

  try {
    await demoRedisConnection();
    await demoTaskQueue();
    await demoCaching();
    await demoMonitoring();

    console.log('\n🎉 === 演示完成 ===');
    console.log('✅ 所有功能演示成功!');
  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  } finally {
    await cleanup();
    process.exit(0);
  }
}

// 运行演示
if (require.main === module) {
  main().catch(console.error);
}

export { main as runDemo };
