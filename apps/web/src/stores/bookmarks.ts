import { create } from 'zustand';
import { api } from '@/lib/api-client';
import { Bookmark } from '@neolink/shared/schemas';

interface BookmarksState {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
  filters: {
    search?: string;
    tags?: string[];
    sortBy?: 'createdAt' | 'updatedAt' | 'title';
    sortOrder?: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };

  // Actions
  fetchBookmarks: () => Promise<void>;
  createBookmark: (data: {
    url: string;
    title?: string;
    tags?: string[];
  }) => Promise<void>;
  updateBookmark: (id: string, data: Partial<Bookmark>) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  setFilters: (filters: Partial<BookmarksState['filters']>) => void;
  setPage: (page: number) => void;
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  bookmarks: [],
  loading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },

  fetchBookmarks: async () => {
    set({ loading: true, error: null });
    try {
      const { pagination, filters } = get();
      const result = await api.bookmarks.list();

      set({
        bookmarks: result,
        pagination: {
          ...pagination,
          total: result.length,
        },
        loading: false,
      });
    } catch (error) {
      set({
        bookmarks: [],
        error: 'Failed to fetch bookmarks',
        loading: false,
      });
    }
  },

  createBookmark: async (data) => {
    try {
      await api.bookmarks.create(data);
      await get().fetchBookmarks();
    } catch (error) {
      throw new Error('Failed to create bookmark');
    }
  },

  updateBookmark: async (id, data) => {
    try {
      await api.bookmarks.update({ id, ...data });
      await get().fetchBookmarks();
    } catch (error) {
      throw new Error('Failed to update bookmark');
    }
  },

  deleteBookmark: async (id) => {
    try {
      await api.bookmarks.delete({ id });
      await get().fetchBookmarks();
    } catch (error) {
      throw new Error('Failed to delete bookmark');
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }));
  },

  setPage: (page) => {
    set((state) => ({
      pagination: { ...state.pagination, page },
    }));
  },
}));
