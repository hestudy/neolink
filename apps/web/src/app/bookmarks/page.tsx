import { EnhancedBookmarkList } from '@/components/bookmarks/EnhancedBookmarkList';
import { AddBookmarkButton } from '@/components/bookmarks/AddBookmarkButton';
import { ProtectedRoute } from '@/components/auth/AuthGuard';

export default function BookmarksPage() {
  return (
    <ProtectedRoute>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">所有书签</h1>
          <AddBookmarkButton />
        </div>

        <EnhancedBookmarkList
          showSummaryFeatures={true}
          enableBatchOperations={true}
          enableSummaryFeedback={false}
          viewMode="grid"
        />
      </div>
    </ProtectedRoute>
  );
}
