'use client';

import { useState, useCallback, useMemo } from 'react';
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
  CreateBookmarkSchema,
  CreateBookmarkInput,
} from '@/lib/validations/bookmark';
import { showSuccess, showError, showLoading } from '@/lib/toast';
import toast from 'react-hot-toast';
import { api } from '@/lib/api-client';
import { debounce } from '@/lib/utils/debounce';

interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBookmarkDialog({
  open,
  onOpenChange,
}: AddBookmarkDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [extractedData, setExtractedData] = useState<{
    title?: string;
    description?: string;
  } | null>(null);

  const { createBookmark } = useBookmarksStore();

  const form = useForm<CreateBookmarkInput>({
    resolver: zodResolver(CreateBookmarkSchema),
    defaultValues: {
      url: '',
      title: '',
      description: '',
      tags: [],
    },
  });

  const currentTags = form.watch('tags') || [];

  const extractUrlInfo = useCallback(
    async (url: string) => {
      if (!url || !url.startsWith('http')) return;

      let loadingToast: string | undefined;

      try {
        setIsLoading(true);
        loadingToast = showLoading('正在提取网页信息...');

        // 调用真实的API来提取网页信息
        const extractedInfo = await api.bookmarks.preview(url);

        setExtractedData({
          title: extractedInfo.title,
          description: extractedInfo.description,
        });

        if (!form.getValues('title')) {
          form.setValue('title', extractedInfo.title);
        }
        if (!form.getValues('description')) {
          form.setValue('description', extractedInfo.description);
        }

        // 清除loading toast并显示成功消息
        if (loadingToast) {
          toast.dismiss(loadingToast);
        }
        showSuccess('网页信息提取成功');
      } catch (error) {
        // 清除loading toast并显示错误消息
        if (loadingToast) {
          toast.dismiss(loadingToast);
        }
        showError('提取网页信息失败');
        console.error('URL extraction error:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [form]
  );

  const debouncedUrlExtraction = useMemo(
    () => debounce(extractUrlInfo, 500),
    [extractUrlInfo]
  );

  const handleUrlChange = (url: string) => {
    if (url && url.startsWith('http') && process.env.NODE_ENV !== 'test') {
      debouncedUrlExtraction(url);
    }
  };

  const handleUrlBlur = () => {
    const url = form.getValues('url');
    if (url && url.startsWith('http') && process.env.NODE_ENV !== 'test') {
      // 立即提取，不等待防抖
      extractUrlInfo(url);
    }
  };

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

  const onSubmit = async (data: CreateBookmarkInput) => {
    let loadingToast: string | undefined;

    try {
      setIsLoading(true);
      loadingToast = showLoading('正在添加书签...');

      await createBookmark(data);

      // 清除loading toast并显示成功消息
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
      showSuccess('书签添加成功');
      onOpenChange(false);
      form.reset();
      setExtractedData(null);
      setTagInput('');
    } catch (error: any) {
      // 清除loading toast并显示错误消息
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
      showError(error.message || '添加书签失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!isLoading) {
      onOpenChange(open);
      if (!open) {
        form.reset();
        setExtractedData(null);
        setTagInput('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加新书签</DialogTitle>
          <DialogDescription>
            输入网页URL，系统将自动提取标题和描述信息
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>网页地址 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleUrlChange(e.target.value);
                      }}
                      onBlur={handleUrlBlur}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标题 *</FormLabel>
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
              <FormLabel htmlFor="tag-input">标签</FormLabel>
              <div className="flex gap-2">
                <Input
                  id="tag-input"
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
                {isLoading ? '添加中...' : '添加书签'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
