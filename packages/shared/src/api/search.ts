/**
 * 搜索相关的 API 路由器定义
 */

export const searchRouter = {
  _type: 'search',
  routes: {
    search: {
      method: 'POST',
      path: '/search',
      description: '全文搜索',
    },
    suggestions: {
      method: 'GET',
      path: '/search/suggestions',
      description: '搜索建议',
    },
    similar: {
      method: 'GET',
      path: '/search/similar/:bookmarkId',
      description: '相似内容推荐',
    },
    history: {
      method: 'GET',
      path: '/search/history',
      description: '搜索历史',
    },
    clearHistory: {
      method: 'DELETE',
      path: '/search/history',
      description: '清除搜索历史',
    },
  },
};
