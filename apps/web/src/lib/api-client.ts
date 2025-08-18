// Simple HTTP client for development with JWT auth support
const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
};

export const api = {
  bookmarks: {
    list: async () => {
      // In a real implementation, this would include auth headers
      const token = getAuthToken();

      return [
        {
          id: '1',
          url: 'https://example.com',
          title: '示例书签 1',
          description: '这是一个示例书签描述',
          content: 'AI生成的摘要内容...',
          favicon: 'https://example.com/favicon.ico',
          userId: 'user-1',
          tags: ['示例', '技术'],
          isArchived: false,
          isPrivate: false,
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 0,
        },
        {
          id: '2',
          url: 'https://github.com',
          title: '示例书签 2',
          description: 'GitHub 是一个代码托管平台',
          content: 'GitHub 提供 Git 仓库托管服务...',
          favicon: 'https://github.com/favicon.ico',
          userId: 'user-1',
          tags: ['开发', '工具'],
          isArchived: false,
          isPrivate: false,
          isFavorite: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 5,
        },
      ];
    },
    get: async ({ id }: { id: string }) => {
      // In a real implementation, this would include auth headers
      const token = getAuthToken();

      return {
        id,
        url: 'https://example.com',
        title: '示例书签 #' + id,
        description: '这是一个示例书签描述',
        content: 'AI生成的摘要内容...',
        favicon: 'https://example.com/favicon.ico',
        userId: 'user-1',
        tags: ['示例', '技术'],
        isArchived: false,
        isPrivate: false,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
      };
    },
    create: async (data: any) => {
      // In a real implementation, this would include auth headers
      const token = getAuthToken();

      return {
        id: Date.now().toString(),
        ...data,
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    update: async ({ id, ...data }: any) => {
      // In a real implementation, this would include auth headers
      const token = getAuthToken();

      return { id, ...data, updatedAt: new Date() };
    },
    delete: async ({ id }: { id: string }) => {
      // In a real implementation, this would include auth headers
      const token = getAuthToken();

      return { success: true };
    },
  },

  // Authentication methods
  auth: {
    setToken: (token: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('authToken', token);
      }
    },
    getToken: getAuthToken,
    clearToken: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
      }
    },
  },
};

// Mock API client for development
export const mockApi = api;
