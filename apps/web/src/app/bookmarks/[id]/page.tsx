'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Bookmark } from '@neolink/shared/schemas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BookmarkDetailSummary } from '@/components/bookmarks/BookmarkDetailSummary';
import { ArrowLeft, ExternalLink, Edit, Trash2 } from 'lucide-react';

export default function BookmarkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bookmarkId = params.id as string;

  useEffect(() => {
    if (bookmarkId) {
      loadBookmark();
    }
  }, [bookmarkId]);

  const loadBookmark = async () => {
    try {
      setLoading(true);
      const data = await api.bookmarks.get({ id: bookmarkId });
      setBookmark(data);
    } catch (err) {
      setError('无法加载书签详情');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleExternalClick = () => {
    if (bookmark) {
      window.open(bookmark.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !bookmark) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error || '书签未找到'}</p>
        <Button variant="outline" className="mt-4" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回列表
        </Button>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleExternalClick}>
            <ExternalLink className="h-4 w-4 mr-2" />
            访问链接
          </Button>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            编辑
          </Button>
          <Button variant="outline" className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{bookmark.title}</CardTitle>
              <CardDescription>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {bookmark.url}
                </a>
              </CardDescription>
            </CardHeader>

            <CardContent>
              {bookmark.description && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">描述</h3>
                  <p className="text-muted-foreground">
                    {bookmark.description}
                  </p>
                </div>
              )}

              {/* AI 摘要详细展示 */}
              <BookmarkDetailSummary
                bookmarkId={bookmark.id}
                summary={bookmark.summary}
                summaryMetadata={bookmark.summaryMetadata}
                processingStatus={bookmark.processingStatus}
                className="mb-4"
              />
            </CardContent>
          </Card>

          {bookmark.favicon && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>网站图标</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={bookmark.favicon}
                  alt={bookmark.title}
                  className="w-full rounded-lg border max-w-16 h-16"
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>书签信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">标签</h4>
                  {bookmark.tags && bookmark.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {bookmark.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">无标签</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-2">创建时间</h4>
                  <p className="text-muted-foreground">
                    {new Date(bookmark.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>

                {bookmark.updatedAt !== bookmark.createdAt && (
                  <div>
                    <h4 className="font-semibold mb-2">更新时间</h4>
                    <p className="text-muted-foreground">
                      {new Date(bookmark.updatedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
