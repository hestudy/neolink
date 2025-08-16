/**
 * 标签相关的 API 路由器定义
 */

export const tagsRouter = {
  _type: 'tags',
  routes: {
    create: {
      method: 'POST',
      path: '/tags',
      description: '创建标签',
    },
    list: {
      method: 'GET',
      path: '/tags',
      description: '获取标签列表',
    },
    get: {
      method: 'GET',
      path: '/tags/:id',
      description: '获取单个标签',
    },
    update: {
      method: 'PUT',
      path: '/tags/:id',
      description: '更新标签',
    },
    delete: {
      method: 'DELETE',
      path: '/tags/:id',
      description: '删除标签',
    },
    stats: {
      method: 'GET',
      path: '/tags/stats',
      description: '标签使用统计',
    },
    merge: {
      method: 'POST',
      path: '/tags/merge',
      description: '合并标签',
    },
  },
};
