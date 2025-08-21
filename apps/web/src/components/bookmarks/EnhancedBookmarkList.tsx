'use client';

import React, { useEffect, useState } from 'react';
import { useBookmarksStore } from '@/stores/bookmarks';
import { BookmarkCard } from './BookmarkCard';
import { BatchSummaryGenerator } from './BatchSummaryGenerator';
import { EditBookmarkDialog } from '@/components/dialogs/EditBookmarkDialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  Sparkles,
  Filter,
  SortAsc,
  Grid3x3,
  List,
} from 'lucide-react';
import { Bookmark } from '@neolink/shared/schemas';
import { cn } from '@/lib/utils';

interface EnhancedBookmarkListProps {
  showSummaryFeatures?: boolean;
  enableBatchOperations?: boolean;
  enableSummaryFeedback?: boolean;
  viewMode?: 'grid' | 'list';
}

type FilterType = 'all' | 'with_summary' | 'without_summary' | 'processing';
type SortType = 'created_desc' | 'created_asc' | 'title_asc' | 'updated_desc';

export function EnhancedBookmarkList({
  showSummaryFeatures = true,
  enableBatchOperations = true,
  enableSummaryFeedback = false,
  viewMode = 'grid',
}: EnhancedBookmarkListProps) {
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(
    null
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // 批量操作状态
  const [selectedBookmarks, setSelectedBookmarks] = useState<string[]>([]);
  const [showBatchGenerator, setShowBatchGenerator] = useState(false);

  // 过滤和排序
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('created_desc');
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);

  const { bookmarks, loading, error, fetchBookmarks } = useBookmarksStore();

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const handleEdit = (bookmarkId: string) => {
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
    if (bookmark) {
      setEditingBookmark(bookmark);
      setIsEditDialogOpen(true);
    }
  };

  const handleDelete = (bookmarkId: string) => {
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
    if (bookmark) {
      setDeletingBookmark(bookmark);
      setIsDeleteDialogOpen(true);
    }
  };

  // 批量选择逻辑
  const handleSelectBookmark = (bookmarkId: string) => {
    setSelectedBookmarks((prev) =>
      prev.includes(bookmarkId)
        ? prev.filter((id) => id !== bookmarkId)
        : [...prev, bookmarkId]
    );
  };

  const handleSelectAll = () => {
    const filteredBookmarks = getFilteredAndSortedBookmarks();
    if (selectedBookmarks.length === filteredBookmarks.length) {
      setSelectedBookmarks([]);
    } else {
      setSelectedBookmarks(filteredBookmarks.map((b) => b.id));
    }
  };

  const clearSelection = () => {
    setSelectedBookmarks([]);
  };

  // 过滤和排序逻辑
  const getFilteredAndSortedBookmarks = () => {
    let filtered = [...bookmarks];

    // 应用过滤器
    switch (filter) {
      case 'with_summary':
        filtered = filtered.filter((b) => b.summary);
        break;
      case 'without_summary':
        filtered = filtered.filter((b) => !b.summary);
        break;
      case 'processing':
        filtered = filtered.filter((b) => b.processingStatus === 'processing');
        break;
    }

    // 应用排序
    switch (sort) {
      case 'created_asc':
        filtered.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case 'created_desc':
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'title_asc':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'updated_desc':
        filtered.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        break;
    }

    return filtered;
  };

  const filteredBookmarks = getFilteredAndSortedBookmarks();
  const bookmarkTitles = Object.fromEntries(
    filteredBookmarks.map((b) => [b.id, b.title || ''])
  );

  // 统计信息
  const stats = {
    total: bookmarks.length,
    withSummary: bookmarks.filter((b) => b.summary).length,
    processing: bookmarks.filter((b) => b.processingStatus === 'processing')
      .length,
  };

  const renderFiltersAndControls = () => (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* 过滤器 */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="text-sm border border-input rounded px-2 py-1"
        >
          <option value="all">全部 ({stats.total})</option>
          <option value="with_summary">有摘要 ({stats.withSummary})</option>
          <option value="without_summary">
            无摘要 ({stats.total - stats.withSummary})
          </option>
          <option value="processing">处理中 ({stats.processing})</option>
        </select>
      </div>

      {/* 排序 */}
      <div className="flex items-center gap-2">
        <SortAsc className="h-4 w-4 text-muted-foreground" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="text-sm border border-input rounded px-2 py-1"
        >
          <option value="created_desc">最新创建</option>
          <option value="created_asc">最早创建</option>
          <option value="updated_desc">最近更新</option>
          <option value="title_asc">标题 A-Z</option>
        </select>
      </div>

      {/* 视图模式 */}
      <div className="flex items-center gap-1 border rounded-md p-1">
        <Button
          variant={currentViewMode === 'grid' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setCurrentViewMode('grid')}
          className="h-7 w-7 p-0"
        >
          <Grid3x3 className="h-3 w-3" />
        </Button>
        <Button
          variant={currentViewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setCurrentViewMode('list')}
          className="h-7 w-7 p-0"
        >
          <List className="h-3 w-3" />
        </Button>
      </div>

      {/* 批量操作 */}
      {enableBatchOperations && showSummaryFeatures && (
        <div className="flex items-center gap-2 ml-auto">
          {selectedBookmarks.length > 0 && (
            <>
              <Badge variant="secondary">
                已选择 {selectedBookmarks.length} 个
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBatchGenerator(true)}
                className="flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                批量摘要
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                清除
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const renderBatchSelector = () => {
    if (!enableBatchOperations || !showSummaryFeatures) return null;

    const isAllSelected = selectedBookmarks.length === filteredBookmarks.length;
    const isPartialSelected =
      selectedBookmarks.length > 0 &&
      selectedBookmarks.length < filteredBookmarks.length;

    return (
      <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="flex items-center gap-2"
        >
          {isAllSelected ? (
            <CheckSquare className="h-4 w-4" />
          ) : isPartialSelected ? (
            <CheckSquare className="h-4 w-4 opacity-50" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          全选
        </Button>

        {selectedBookmarks.length > 0 && (
          <div className="text-sm text-muted-foreground">
            已选择 {selectedBookmarks.length} / {filteredBookmarks.length}{' '}
            个书签
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-muted-foreground text-lg">还没有书签</p>
        <p className="text-sm text-muted-foreground mt-2">
          开始添加你的第一个书签吧！
        </p>
      </div>
    );
  }

  return (
    <>
      {renderFiltersAndControls()}
      {renderBatchSelector()}

      {/* 批量摘要生成器 */}
      {showBatchGenerator && (
        <div className="mb-6">
          <BatchSummaryGenerator
            selectedBookmarks={selectedBookmarks}
            bookmarkTitles={bookmarkTitles}
            onJobsComplete={(results) => {
              console.log('Batch generation completed:', results);
              setShowBatchGenerator(false);
              clearSelection();
              // 刷新书签列表
              fetchBookmarks();
            }}
          />
        </div>
      )}

      {/* 书签列表 */}
      <div
        className={cn(
          currentViewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        )}
      >
        {filteredBookmarks.map((bookmark) => (
          <div key={bookmark.id} className="relative">
            {enableBatchOperations && showSummaryFeatures && (
              <div className="absolute top-2 left-2 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectBookmark(bookmark.id)}
                  className={cn(
                    'h-6 w-6 p-0 rounded-full',
                    selectedBookmarks.includes(bookmark.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background/80 backdrop-blur-sm'
                  )}
                >
                  {selectedBookmarks.includes(bookmark.id) ? (
                    <CheckSquare className="h-3 w-3" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}

            <BookmarkCard
              bookmark={bookmark}
              onEdit={handleEdit}
              onDelete={handleDelete}
              showSummary={showSummaryFeatures}
              enableSummaryFeedback={enableSummaryFeedback}
            />
          </div>
        ))}
      </div>

      {filteredBookmarks.length === 0 && bookmarks.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>没有符合条件的书签</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter('all')}
            className="mt-2"
          >
            清除过滤器
          </Button>
        </div>
      )}

      {/* 对话框 */}
      <EditBookmarkDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingBookmark(null);
          }
        }}
        bookmark={editingBookmark}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeletingBookmark(null);
          }
        }}
        bookmark={deletingBookmark}
        mode="single"
      />
    </>
  );
}
