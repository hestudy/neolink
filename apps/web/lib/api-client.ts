// Simple HTTP client for development
export const api = {
  bookmarks: {
    list: async () => {
      return [
        {
          id: '1',
          title: '示例书签 1',
          url: 'https://example.com',
          description: '这是一个示例书签描述',
          summary: 'AI生成的摘要内容...',
          tags: ['示例', '技术'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          contentType: 'website',
          screenshot: null,
        },
        {
          id: '2',
          title: '示例书签 2',
          url: 'https://github.com',
          description: 'GitHub 是一个代码托管平台',
          summary: 'GitHub 提供 Git 仓库托管服务...',
          tags: ['开发', '工具'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          contentType: 'website',
          screenshot: null,
        },
      ];
    },
    get: async ({ id }: { id: string }) => {
      return {
        id,
        title: '示例书签 #' + id,
        url: 'https://example.com',
        description: '这是一个示例书签描述',
        summary: 'AI生成的摘要内容...',
        tags: ['示例', '技术'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contentType: 'website',
        screenshot: null,
      };
    },
    create: async (data: any) => {
      return { id: Date.now().toString(), ...data };
    },
    update: async ({ id, ...data }: any) => {
      return { id, ...data };
    },
    delete: async ({ id }: { id: string }) => {
      return { success: true };
    },
  },
};

// Mock API client for development
export const mockApi = api;
