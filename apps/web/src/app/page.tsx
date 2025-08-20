import { BookmarkList } from '@/components/bookmarks/BookmarkList';
import { AddBookmarkButton } from '@/components/bookmarks/AddBookmarkButton';

export default function Home() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">我的书签</h1>
        <AddBookmarkButton />
      </div>

      <BookmarkList />
    </div>
  );
}
