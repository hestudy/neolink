import { BookmarkList } from '@/components/bookmarks/BookmarkList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Home() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">我的书签</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          添加书签
        </Button>
      </div>

      <BookmarkList />
    </div>
  );
}
