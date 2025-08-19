'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2 } from 'lucide-react';
import { useBookmarksStore } from '@/stores/bookmarks';
import {
  UpdateBookmarkSchema,
  UpdateBookmarkInput,
} from '@/lib/validations/bookmark';
import { showSuccess, showError, showLoading } from '@/lib/toast';
import { Bookmark } from '@neolink/shared/schemas';

interface EditBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark: Bookmark | null;
}

export function EditBookmarkDialog({
  open,
  onOpenChange,
  bookmark,
}: EditBookmarkDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const { updateBookmark } = useBookmarksStore();

  const form = useForm<UpdateBookmarkInput>({
    resolver: zodResolver(UpdateBookmarkSchema),
    defaultValues: {
      title: '',
      description: '',
      tags: [],
      isArchived: false,
      isFavorite: false,
    },
  });

  // 当书签数据变化时重置表单
  useEffect(() => {
    if (bookmark && open) {
      form.reset({
        title: bookmark.title || '',
        description: bookmark.description || '',
        tags: bookmark.tags || [],
        isArchived: bookmark.isArchived || false,
        isFavorite: bookmark.isFavorite || false,
      });
    }
  }, [bookmark, open, form]);

  const currentTags = form.watch('tags') || [];

  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (
      trimmedTag &&
      !currentTags.includes(trimmedTag) &&
      currentTags.length < 20
    ) {
      form.setValue('tags', [...currentTags, trimmedTag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    form.setValue(
      'tags',
      currentTags.filter((tag) => tag !== tagToRemove)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const onSubmit = async (data: UpdateBookmarkInput) => {
    if (!bookmark) return;

    try {
      setIsLoading(true);
      const loadingToast = showLoading('正在更新书签...');

      await updateBookmark(bookmark.id, data);

      showSuccess('书签更新成功');
      onOpenChange(false);
    } catch (error: any) {
      showError(error.message || '更新书签失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!isLoading) {
      onOpenChange(open);
      if (!open) {
        setTagInput('');
        form.reset();
      }
    }
  };

  if (!bookmark) return null;

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑书签</DialogTitle>
          <DialogDescription>
            修改书签的标题、描述、标签和备注信息
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                网页地址
              </label>
              <div className="text-sm text-blue-600 break-all bg-muted p-2 rounded">
                {bookmark.url}
              </div>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标题</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="书签标题"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="书签描述（可选）"
                      rows={3}
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel htmlFor="edit-tag-input">标签</FormLabel>
              <div className="flex gap-2">
                <Input
                  id="edit-tag-input"
                  placeholder="添加标签..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading || currentTags.length >= 20}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  disabled={
                    !tagInput.trim() ||
                    currentTags.includes(tagInput.trim()) ||
                    currentTags.length >= 20 ||
                    isLoading
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {currentTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentTags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        disabled={isLoading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                最多添加 20 个标签 ({currentTags.length}/20)
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
                disabled={isLoading}
              >
                取消
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? '更新中...' : '保存修改'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
