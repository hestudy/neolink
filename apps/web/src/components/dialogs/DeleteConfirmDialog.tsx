'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useBookmarksStore } from '@/stores/bookmarks';
import { showSuccess, showError, showLoading } from '@/lib/toast';
import { Bookmark } from '@neolink/shared/schemas';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark?: Bookmark | null;
  bookmarks?: Bookmark[];
  mode: 'single' | 'batch';
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  bookmark,
  bookmarks = [],
  mode,
}: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteBookmark, batchDeleteBookmarks, clearSelection } =
    useBookmarksStore();

  const getDialogContent = () => {
    if (mode === 'single' && bookmark) {
      return {
        title: '确认删除书签',
        description: `你确定要删除书签 "${bookmark.title}" 吗？此操作无法撤销。`,
        confirmText: '删除书签',
      };
    }

    if (mode === 'batch' && bookmarks.length > 0) {
      return {
        title: '批量删除书签',
        description: `你确定要删除选中的 ${bookmarks.length} 个书签吗？此操作无法撤销。`,
        confirmText: `删除 ${bookmarks.length} 个书签`,
      };
    }

    return {
      title: '删除确认',
      description: '确定要执行删除操作吗？',
      confirmText: '确认删除',
    };
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const loadingToast = showLoading('正在删除...');

      if (mode === 'single' && bookmark) {
        await deleteBookmark(bookmark.id);
        showSuccess('书签删除成功');
      } else if (mode === 'batch' && bookmarks.length > 0) {
        const bookmarkIds = bookmarks.map((b) => b.id);
        await batchDeleteBookmarks(bookmarkIds);
        showSuccess(`成功删除 ${bookmarks.length} 个书签`);
        clearSelection();
      }

      onOpenChange(false);
    } catch (error: any) {
      showError(error.message || '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const { title, description, confirmText } = getDialogContent();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {mode === 'batch' && bookmarks.length > 0 && (
          <div className="my-4">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              将要删除的书签：
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 p-3 bg-muted rounded-md">
              {bookmarks.slice(0, 10).map((bm) => (
                <div key={bm.id} className="text-sm truncate">
                  • {bm.title}
                </div>
              ))}
              {bookmarks.length > 10 && (
                <div className="text-sm text-muted-foreground">
                  ... 还有 {bookmarks.length - 10} 个书签
                </div>
              )}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting ? '删除中...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
