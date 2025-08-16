/**
 * 系统相关的 API 路由器定义
 */

export const systemRouter = {
  _type: 'system',
  routes: {
    health: {
      method: 'GET',
      path: '/system/health',
      description: '系统健康检查',
    },
    info: {
      method: 'GET',
      path: '/system/info',
      description: '系统信息',
    },
    stats: {
      method: 'GET',
      path: '/system/stats',
      description: '系统统计',
    },
    config: {
      method: 'GET',
      path: '/system/config',
      description: '获取配置',
    },
    updateConfig: {
      method: 'PUT',
      path: '/system/config',
      description: '更新配置',
    },
  },
};
