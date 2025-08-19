/**
 * Bookmark management types - extended from schemas
 */

import type { Bookmark } from '../schemas/index.js';

export interface BookmarkFilters {
  search?: string;
  tags?: string[];
  isArchived?: boolean;
  isFavorite?: boolean;
  contentType?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface BookmarkSortOptions {
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'readTime';
  sortOrder: 'asc' | 'desc';
}

export interface BookmarkListResponse {
  items: Bookmark[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateBookmarkRequest {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface UpdateBookmarkRequest {
  title?: string;
  description?: string;
  tags?: string[];
  isArchived?: boolean;
  isFavorite?: boolean;
  summary?: string;
}

export interface BulkBookmarkAction {
  ids: string[];
  action: 'archive' | 'unarchive' | 'favorite' | 'unfavorite' | 'delete';
}

export interface BookmarkStats {
  total: number;
  archived: number;
  favorites: number;
  tags: Record<string, number>;
  contentTypes: Record<string, number>;
  createdByMonth: Record<string, number>;
}

export interface BookmarkSearchQuery {
  query: string;
  filters?: BookmarkFilters;
  sort?: BookmarkSortOptions;
  page?: number;
  limit?: number;
}

export interface BookmarkSuggestion {
  url: string;
  title: string;
  description: string;
  favicon: string;
  tags: string[];
  confidence: number;
}
