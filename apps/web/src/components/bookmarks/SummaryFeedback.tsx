import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  MessageSquare,
  Star,
  Flag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackData {
  rating: 1 | 2 | 3 | 4 | 5 | null;
  helpful: boolean | null;
  issues: string[];
  comment: string;
}

interface SummaryFeedbackProps {
  bookmarkId: string;
  summaryId?: string;
  onFeedbackSubmit?: (feedback: FeedbackData) => void;
  className?: string;
  compact?: boolean;
}

export const SummaryFeedback: React.FC<SummaryFeedbackProps> = ({
  bookmarkId,
  summaryId,
  onFeedbackSubmit,
  className,
  compact = false,
}) => {
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: null,
    helpful: null,
    issues: [],
    comment: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);

  const issueOptions = [
    { id: 'accuracy', label: '内容不准确', icon: AlertTriangle },
    { id: 'length', label: '长度不合适', icon: MessageSquare },
    { id: 'language', label: '语言问题', icon: Flag },
    { id: 'relevance', label: '相关性差', icon: AlertTriangle },
    { id: 'coherence', label: '逻辑不清', icon: MessageSquare },
  ];

  const handleRatingChange = (rating: 1 | 2 | 3 | 4 | 5) => {
    setFeedback((prev) => ({ ...prev, rating }));
    if (rating >= 4) {
      setFeedback((prev) => ({ ...prev, helpful: true }));
    }
  };

  const handleHelpfulnessChange = (helpful: boolean) => {
    setFeedback((prev) => ({ ...prev, helpful }));
  };

  const handleIssueToggle = (issueId: string) => {
    setFeedback((prev) => ({
      ...prev,
      issues: prev.issues.includes(issueId)
        ? prev.issues.filter((id) => id !== issueId)
        : [...prev.issues, issueId],
    }));
  };

  const handleSubmit = async () => {
    try {
      // 这里应该调用API提交反馈
      const response = await fetch(
        `/api/bookmarks/${bookmarkId}/summary/feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summaryId,
            ...feedback,
          }),
        }
      );

      if (response.ok) {
        setIsSubmitted(true);
        onFeedbackSubmit?.(feedback);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const renderStarRating = () => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Button
          key={star}
          variant="ghost"
          size="sm"
          onClick={() => handleRatingChange(star as 1 | 2 | 3 | 4 | 5)}
          className={cn(
            'p-1 h-auto',
            feedback.rating && star <= feedback.rating
              ? 'text-yellow-500'
              : 'text-muted-foreground hover:text-yellow-500'
          )}
        >
          <Star
            className={cn(
              'h-4 w-4',
              feedback.rating && star <= feedback.rating && 'fill-current'
            )}
          />
        </Button>
      ))}
      {feedback.rating && (
        <span className="text-sm text-muted-foreground ml-2">
          {feedback.rating}/5
        </span>
      )}
    </div>
  );

  const renderHelpfulnessButtons = () => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">有帮助吗?</span>
      <Button
        variant={feedback.helpful === true ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleHelpfulnessChange(true)}
        className="flex items-center gap-1"
      >
        <ThumbsUp className="h-3 w-3" />
        有用
      </Button>
      <Button
        variant={feedback.helpful === false ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => handleHelpfulnessChange(false)}
        className="flex items-center gap-1"
      >
        <ThumbsDown className="h-3 w-3" />
        无用
      </Button>
    </div>
  );

  const renderIssueSelection = () => (
    <div className="space-y-2">
      <span className="text-sm font-medium">遇到的问题:</span>
      <div className="flex flex-wrap gap-2">
        {issueOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = feedback.issues.includes(option.id);

          return (
            <Button
              key={option.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleIssueToggle(option.id)}
              className="flex items-center gap-1 text-xs"
            >
              <Icon className="h-3 w-3" />
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );

  const renderCommentInput = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium">额外建议 (可选):</label>
      <textarea
        value={feedback.comment}
        onChange={(e) =>
          setFeedback((prev) => ({ ...prev, comment: e.target.value }))
        }
        placeholder="请分享您的具体建议..."
        className="w-full min-h-[60px] px-3 py-2 text-sm border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        maxLength={500}
      />
      <div className="text-xs text-muted-foreground text-right">
        {feedback.comment.length}/500
      </div>
    </div>
  );

  if (isSubmitted) {
    return (
      <div
        className={cn(
          'text-center py-4 text-sm text-muted-foreground',
          className
        )}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <ThumbsUp className="h-4 w-4 text-green-600" />
          <span>感谢您的反馈！</span>
        </div>
        <p className="text-xs">您的意见将帮助我们改进摘要质量</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        {renderHelpfulnessButtons()}

        {(feedback.helpful === false || showDetailedFeedback) && (
          <div className="space-y-2">
            {renderStarRating()}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetailedFeedback(!showDetailedFeedback)}
              className="text-xs"
            >
              {showDetailedFeedback ? '简化反馈' : '详细反馈'}
            </Button>

            {showDetailedFeedback && (
              <div className="space-y-2">
                {renderIssueSelection()}
                {renderCommentInput()}
              </div>
            )}
          </div>
        )}

        {(feedback.helpful !== null || feedback.rating !== null) && (
          <Button
            size="sm"
            onClick={handleSubmit}
            className="w-full text-xs"
            disabled={feedback.helpful === null && feedback.rating === null}
          >
            提交反馈
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          摘要质量反馈
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium mb-2 block">整体评分:</span>
            {renderStarRating()}
          </div>

          {renderHelpfulnessButtons()}

          {feedback.helpful === false && (
            <div className="space-y-3">
              {renderIssueSelection()}
              {renderCommentInput()}
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={feedback.helpful === null && feedback.rating === null}
          className="w-full"
        >
          提交反馈
        </Button>
      </CardContent>
    </Card>
  );
};
