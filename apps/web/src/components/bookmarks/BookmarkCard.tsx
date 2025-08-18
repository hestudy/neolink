import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Edit, Trash2, Eye } from 'lucide-react';
import { Bookmark } from '@neolink/shared/schemas';
import DOMPurify from 'dompurify';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
}: BookmarkCardProps) {
  const handleExternalClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {bookmark.favicon && (
        <div className="aspect-video overflow-hidden">
          <img
            src={bookmark.favicon}
            alt={bookmark.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-lg line-clamp-2">{bookmark.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {DOMPurify.sanitize(bookmark.description || bookmark.url)}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {bookmark.tags && bookmark.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {bookmark.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <div>创建于: {new Date(bookmark.createdAt).toLocaleDateString()}</div>
          {bookmark.updatedAt !== bookmark.createdAt && (
            <div>
              更新于: {new Date(bookmark.updatedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExternalClick}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          访问
        </Button>

        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = `/bookmarks/${bookmark.id}`)}
            className="flex items-center gap-2"
            aria-label={`查看 ${bookmark.title} 详情`}
          >
            <Eye className="h-4 w-4" />
            查看
          </Button>

          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(bookmark.id)}
              className="flex items-center gap-2"
              aria-label={`编辑 ${bookmark.title}`}
            >
              <Edit className="h-4 w-4" />
              编辑
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(bookmark.id)}
              className="flex items-center gap-2 text-destructive hover:text-destructive"
              aria-label={`删除 ${bookmark.title}`}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
