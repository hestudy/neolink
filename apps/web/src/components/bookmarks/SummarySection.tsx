import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryMetadata {
  version: number;
  generatedAt: string;
  provider: string;
  confidence: number;
  language: string;
  tokensUsed: number;
  cost: number;
}

interface SummaryResult {
  summary: string;
  metadata?: SummaryMetadata;
}

interface SummaryJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: SummaryResult;
}

interface SummarySectionProps {
  bookmarkId: string;
  summary?: string | null;
  summaryMetadata?: SummaryMetadata | null;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  onRegenerate?: () => void;
  compact?: boolean;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  bookmarkId,
  summary,
  summaryMetadata,
  processingStatus,
  onRegenerate,
  compact = false,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<SummaryJobStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showMetadata, setShowMetadata] = useState(false);

  // 轮询任务状态
  useEffect(() => {
    if (
      jobStatus &&
      jobStatus.status !== 'completed' &&
      jobStatus.status !== 'failed'
    ) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/bookmarks/${bookmarkId}/summary/status/${jobStatus.jobId}`
          );
          if (response.ok) {
            const updatedStatus = await response.json();
            setJobStatus(updatedStatus);

            if (
              updatedStatus.status === 'completed' ||
              updatedStatus.status === 'failed'
            ) {
              setIsGenerating(false);
              clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Error polling summary status:', error);
          clearInterval(pollInterval);
          setIsGenerating(false);
        }
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [bookmarkId, jobStatus]);

  const handleGenerateSummary = async (
    summaryLength: 'short' | 'medium' | 'long' = 'medium'
  ) => {
    setIsGenerating(true);
    setJobStatus(null);

    try {
      const response = await fetch(
        `/api/bookmarks/${bookmarkId}/summary/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summaryLength,
            force: !!summary, // 如果已有摘要则强制重新生成
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setJobStatus({
          jobId: result.jobId,
          status: 'pending',
          progress: 0,
        });
      } else {
        const error = await response.json();
        console.error('Failed to generate summary:', error);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setIsGenerating(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadgeVariant = (
    confidence: number
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.6) return 'secondary';
    return 'destructive';
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  // 渲染进度指示器
  const renderProgress = () => {
    if (!jobStatus || jobStatus.status === 'completed') return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 animate-spin" />
            {jobStatus.status === 'pending' && '队列中...'}
            {jobStatus.status === 'processing' && '生成中...'}
            {jobStatus.status === 'failed' && '生成失败'}
          </span>
          <span>{jobStatus.progress}%</span>
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              jobStatus.status === 'failed' ? 'bg-destructive' : 'bg-primary'
            )}
            style={{ width: `${jobStatus.progress}%` }}
          />
        </div>

        {jobStatus.status === 'failed' && jobStatus.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {jobStatus.error}
          </div>
        )}
      </div>
    );
  };

  // 渲染摘要内容
  const renderSummaryContent = () => {
    // 显示任务结果（如果有的话）
    const displaySummary = jobStatus?.result?.summary || summary;
    const displayMetadata = jobStatus?.result?.metadata || summaryMetadata;

    if (!displaySummary) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">暂无摘要</p>
          <p className="text-xs mt-1">点击生成按钮创建AI摘要</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div
          className={cn(
            'text-sm leading-relaxed',
            !isExpanded && compact && 'line-clamp-3'
          )}
        >
          {displaySummary}
        </div>

        {displayMetadata && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant={getConfidenceBadgeVariant(displayMetadata.confidence)}
              className="text-xs"
            >
              置信度 {Math.round(displayMetadata.confidence * 100)}%
            </Badge>

            <Badge variant="outline" className="text-xs">
              {displayMetadata.provider.toUpperCase()}
            </Badge>

            <span>v{displayMetadata.version}</span>

            <span>
              {new Date(displayMetadata.generatedAt).toLocaleDateString()}
            </span>

            {showMetadata && (
              <>
                <span>•</span>
                <span>{displayMetadata.tokensUsed} tokens</span>
                <span>•</span>
                <span>{formatCost(displayMetadata.cost)}</span>
              </>
            )}
          </div>
        )}

        {compact && displaySummary.length > 150 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs h-auto p-1"
          >
            {isExpanded ? (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                收起
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                展开
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  // 渲染操作按钮
  const renderActions = () => {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateSummary('medium')}
            disabled={isGenerating}
            className="text-xs"
          >
            {isGenerating ? (
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {summary ? '重新生成' : '生成摘要'}
          </Button>

          {!compact && summary && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGenerateSummary('short')}
                disabled={isGenerating}
                className="text-xs"
              >
                短摘要
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGenerateSummary('long')}
                disabled={isGenerating}
                className="text-xs"
              >
                长摘要
              </Button>
            </>
          )}
        </div>

        {summaryMetadata && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMetadata(!showMetadata)}
            className="text-xs"
          >
            <TrendingUp className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  if (compact) {
    // 紧凑模式：在 BookmarkCard 中使用
    return (
      <div className="space-y-3">
        {renderProgress()}
        {renderSummaryContent()}
        {renderActions()}
      </div>
    );
  }

  // 完整模式：在详情页中使用
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI 摘要
          {processingStatus === 'completed' && summary && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}
        {renderSummaryContent()}
        {renderActions()}
      </CardContent>
    </Card>
  );
};
