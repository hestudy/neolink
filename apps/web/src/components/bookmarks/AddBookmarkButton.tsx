'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AddBookmarkDialog } from '@/components/dialogs/AddBookmarkDialog';

export function AddBookmarkButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        添加书签
      </Button>

      <AddBookmarkDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
