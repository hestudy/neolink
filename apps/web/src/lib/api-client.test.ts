import { api, mockApi } from './api-client';

describe('api-client', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should set and get auth token', () => {
    const token = 'test-token';

    // Set token
    api.auth.setToken(token);

    // Get token
    expect(api.auth.getToken()).toBe(token);
  });

  it('should clear auth token', () => {
    const token = 'test-token';

    // Set token
    api.auth.setToken(token);
    expect(api.auth.getToken()).toBe(token);

    // Clear token
    api.auth.clearToken();
    expect(api.auth.getToken()).toBeNull();
  });

  it('should return null for token when not set', () => {
    expect(api.auth.getToken()).toBeNull();
  });

  it('should list bookmarks', async () => {
    const bookmarks = await api.bookmarks.list();
    expect(Array.isArray(bookmarks)).toBe(true);
    expect(bookmarks.length).toBeGreaterThan(0);
  });

  it('should get bookmark by id', async () => {
    const bookmark = await api.bookmarks.get({ id: '1' });
    expect(bookmark).toBeDefined();
    expect(bookmark.id).toBe('1');
  });

  it('should create bookmark', async () => {
    const data = {
      url: 'https://test.com',
      title: '测试书签',
    };

    const result = await api.bookmarks.create(data);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.url).toBe(data.url);
    expect(result.title).toBe(data.title);
  });

  it('should update bookmark', async () => {
    const data = {
      title: '更新标题',
    };

    const result = await api.bookmarks.update({ id: '1', ...data });
    expect(result).toBeDefined();
    expect(result.id).toBe('1');
    expect(result.title).toBe(data.title);
  });

  it('should delete bookmark', async () => {
    const result = await api.bookmarks.delete({ id: '1' });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should export mockApi', () => {
    expect(mockApi).toBe(api);
  });
});
