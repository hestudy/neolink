/**
 * 书签相关的 API 路由器定义
 * 暂时使用简化的结构，等待 oRPC 正确配置后再完善
 */

export const bookmarksRouter = {
  // 路由器类型标识
  _type: 'bookmarks',

  // 路由定义
  routes: {
    create: {
      method: 'POST',
      path: '/bookmarks',
      description: '创建书签',
    },
    list: {
      method: 'GET',
      path: '/bookmarks',
      description: '获取书签列表',
    },
    get: {
      method: 'GET',
      path: '/bookmarks/:id',
      description: '获取单个书签',
    },
    update: {
      method: 'PUT',
      path: '/bookmarks/:id',
      description: '更新书签',
    },
    delete: {
      method: 'DELETE',
      path: '/bookmarks/:id',
      description: '删除书签',
    },
    archive: {
      method: 'POST',
      path: '/bookmarks/:id/archive',
      description: '归档书签',
    },
    unarchive: {
      method: 'POST',
      path: '/bookmarks/:id/unarchive',
      description: '取消归档书签',
    },
    bulkUpdate: {
      method: 'PUT',
      path: '/bookmarks/bulk',
      description: '批量更新书签',
    },
    bulkDelete: {
      method: 'DELETE',
      path: '/bookmarks/bulk',
      description: '批量删除书签',
    },
  },
};
