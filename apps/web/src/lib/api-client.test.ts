import { vi } from 'vitest';
import { api, mockApi } from './api-client';

// Mock fetch globally
global.fetch = vi.fn();

describe('api-client', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    // Clear all mocks
    vi.clearAllMocks();
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
    const mockBookmarks = [
      { id: '1', title: 'Test Bookmark 1', url: 'https://test1.com' },
      { id: '2', title: 'Test Bookmark 2', url: 'https://test2.com' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockBookmarks }),
    } as Response);

    const bookmarks = await api.bookmarks.list();
    expect(Array.isArray(bookmarks)).toBe(true);
    expect(bookmarks).toEqual(mockBookmarks);
  });

  it('should get bookmark by id', async () => {
    const mockBookmark = {
      id: '1',
      title: 'Test Bookmark',
      url: 'https://test.com',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockBookmark }),
    } as Response);

    const bookmark = await api.bookmarks.get({ id: '1' });
    expect(bookmark).toBeDefined();
    expect(bookmark).toEqual(mockBookmark);
  });

  it('should create bookmark', async () => {
    const data = {
      url: 'https://test.com',
      title: '测试书签',
    };

    const mockResult = {
      id: 'new-id',
      ...data,
      createdAt: new Date().toISOString(),
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockResult }),
    } as Response);

    const result = await api.bookmarks.create(data);
    expect(result).toBeDefined();
    expect(result.id).toBe('new-id');
    expect(result.url).toBe(data.url);
    expect(result.title).toBe(data.title);
  });

  it('should update bookmark', async () => {
    const data = {
      title: '更新标题',
    };

    const mockResult = {
      id: '1',
      url: 'https://test.com',
      title: data.title,
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockResult }),
    } as Response);

    const result = await api.bookmarks.update({ id: '1', ...data });
    expect(result).toBeDefined();
    expect(result.id).toBe('1');
    expect(result.title).toBe(data.title);
  });

  it('should delete bookmark', async () => {
    const mockResult = { success: true };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResult),
    } as Response);

    const result = await api.bookmarks.delete({ id: '1' });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should export mockApi', () => {
    expect(mockApi).toBe(api);
  });
});
