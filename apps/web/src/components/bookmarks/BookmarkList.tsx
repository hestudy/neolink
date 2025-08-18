import React, { useEffect } from 'react';
import { useBookmarksStore } from '@/stores/bookmarks';
import { BookmarkCard } from './BookmarkCard';
import { Loader2, AlertCircle } from 'lucide-react';

interface BookmarkListProps {
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function BookmarkList({ onEdit, onDelete }: BookmarkListProps) {
  const { bookmarks, loading, error, fetchBookmarks } = useBookmarksStore();

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
