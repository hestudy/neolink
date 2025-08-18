import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBookmarksStore } from './bookmarks';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  api: {
    bookmarks: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockBookmarks = [
  {
    id: '1',
    url: 'https://example.com',
    title: '测试书签1',
    description: '描述1',
    content: '内容1',
    favicon: 'https://example.com/favicon.ico',
    userId: 'user-1',
    tags: ['测试'],
    isArchived: false,
    isPrivate: false,
    isFavorite: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    accessCount: 0,
  },
  {
    id: '2',
    url: 'https://github.com',
    title: '测试书签2',
    description: '描述2',
    content: '内容2',
    favicon: 'https://github.com/favicon.ico',
    userId: 'user-1',
    tags: ['开发'],
    isArchived: false,
    isPrivate: false,
    isFavorite: true,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    accessCount: 5,
  },
];

describe('useBookmarkStore', () => {
  it('should have initial state', () => {
    const { result } = renderHook(() => useBookmarksStore());

    expect(result.current.bookmarks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.filters).toEqual({});
    expect(result.current.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
    });
  });

  it('should fetch bookmarks successfully', async () => {
    const { api } = await import('@/lib/api-client');
    (api.bookmarks.list as any).mockResolvedValue(mockBookmarks);

    const { result } = renderHook(() => useBookmarksStore());

    await act(async () => {
      await result.current.fetchBookmarks();
    });

    expect(result.current.bookmarks).toEqual(mockBookmarks);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const { api } = await import('@/lib/api-client');
    (api.bookmarks.list as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBookmarksStore());

    await act(async () => {
      await result.current.fetchBookmarks();
    });

    // When there's an error, bookmarks should remain as they were (empty in this case)
    expect(result.current.bookmarks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Failed to fetch bookmarks');
  });

  it('should create bookmark', async () => {
    const { api } = await import('@/lib/api-client');
    const newBookmark = {
      url: 'https://new.com',
      title: '新书签',
      description: '新描述',
      tags: ['新标签'],
    };

    (api.bookmarks.create as any).mockResolvedValue({
      id: '3',
      ...newBookmark,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { result } = renderHook(() => useBookmarksStore());

    await act(async () => {
      await result.current.createBookmark(newBookmark);
    });

    expect(api.bookmarks.create).toHaveBeenCalledWith(newBookmark);
  });

  it('should update bookmark', async () => {
    const { api } = await import('@/lib/api-client');
    const updates = { title: '更新标题' };

    (api.bookmarks.update as any).mockResolvedValue({
      ...mockBookmarks[0],
      ...updates,
      updatedAt: new Date(),
    });

    const { result } = renderHook(() => useBookmarksStore());

    await act(async () => {
      await result.current.updateBookmark('1', updates);
    });

    expect(api.bookmarks.update).toHaveBeenCalledWith({
      id: '1',
      ...updates,
    });
  });

  it('should delete bookmark', async () => {
    const { api } = await import('@/lib/api-client');
    (api.bookmarks.delete as any).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useBookmarksStore());

    await act(async () => {
      await result.current.deleteBookmark('1');
    });

    expect(api.bookmarks.delete).toHaveBeenCalledWith({ id: '1' });
  });
});
