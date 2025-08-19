import { create } from 'zustand';
import { api } from '@/lib/api-client';
import { Bookmark } from '@neolink/shared/schemas';

enum OperationType {
  CREATING = 'creating',
  UPDATING = 'updating',
  DELETING = 'deleting',
  PROCESSING = 'processing',
}

interface BookmarksState {
  // 现有状态
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

  // 新增状态
  selectedBookmarks: string[];
  editingBookmark: string | null;
  processingOperations: Map<string, OperationType>;

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

  // 新增操作
  selectBookmark: (id: string) => void;
  selectAllBookmarks: () => void;
  clearSelection: () => void;
  setEditingBookmark: (id: string | null) => void;
  batchDeleteBookmarks: (ids: string[]) => Promise<void>;
  batchUpdateTags: (ids: string[], tags: string[]) => Promise<void>;
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
  selectedBookmarks: [],
  editingBookmark: null,
  processingOperations: new Map(),

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

  selectBookmark: (id) => {
    set((state) => ({
      selectedBookmarks: state.selectedBookmarks.includes(id)
        ? state.selectedBookmarks.filter((bookmarkId) => bookmarkId !== id)
        : [...state.selectedBookmarks, id],
    }));
  },

  selectAllBookmarks: () => {
    set((state) => ({
      selectedBookmarks:
        state.selectedBookmarks.length === state.bookmarks.length
          ? []
          : state.bookmarks.map((bookmark) => bookmark.id),
    }));
  },

  clearSelection: () => {
    set({ selectedBookmarks: [] });
  },

  setEditingBookmark: (id) => {
    set({ editingBookmark: id });
  },

  batchDeleteBookmarks: async (ids) => {
    try {
      const promises = ids.map((id) => api.bookmarks.delete({ id }));
      await Promise.all(promises);
      await get().fetchBookmarks();
      set({ selectedBookmarks: [] });
    } catch (error) {
      throw new Error('Failed to delete bookmarks');
    }
  },

  batchUpdateTags: async (ids, tags) => {
    try {
      const promises = ids.map((id) => api.bookmarks.update({ id, tags }));
      await Promise.all(promises);
      await get().fetchBookmarks();
    } catch (error) {
      throw new Error('Failed to update bookmark tags');
    }
  },
}));
