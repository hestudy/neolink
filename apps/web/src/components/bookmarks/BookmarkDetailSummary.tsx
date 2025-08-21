import React, { useState } from 'react';
import { SummarySection } from './SummarySection';
import { SummaryFeedback } from './SummaryFeedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  History,
  Download,
  Share2,
  MoreVertical,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface SummaryVersion {
  id: string;
  version: number;
  summary: string;
  generatedAt: string;
  provider: string;
  confidence: number;
  isActive: boolean;
}

interface BookmarkDetailSummaryProps {
  bookmarkId: string;
  summary?: string | null;
  summaryMetadata?: any;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  className?: string;
}

export const BookmarkDetailSummary: React.FC<BookmarkDetailSummaryProps> = ({
  bookmarkId,
  summary,
  summaryMetadata,
  processingStatus,
  className,
}) => {
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<SummaryVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const loadVersionHistory = async () => {
    if (versions.length > 0) {
      setShowVersionHistory(!showVersionHistory);
      return;
    }

    setIsLoadingVersions(true);
    try {
      // 这里应该调用API获取版本历史
      const response = await fetch(
        `/api/bookmarks/${bookmarkId}/summary/versions`
      );
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
        setShowVersionHistory(true);
      }
    } catch (error) {
      console.error('Error loading version history:', error);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleExportSummary = () => {
    if (!summary) return;

    const exportData = {
      summary,
      metadata: summaryMetadata,
      exportedAt: new Date().toISOString(),
      bookmarkId,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${bookmarkId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareSummary = async () => {
    if (!summary) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '书签摘要',
          text: summary,
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // 降级到复制到剪贴板
      try {
        await navigator.clipboard.writeText(summary);
        // 这里应该显示一个提示
        console.log('Summary copied to clipboard');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  const renderVersionHistory = () => {
    if (!showVersionHistory) return null;

    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            版本历史
          </CardTitle>
        </CardHeader>

        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">暂无历史版本</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`p-3 rounded-lg border ${
                    version.isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={version.isActive ? 'default' : 'secondary'}
                      >
                        v{version.version}
                      </Badge>
                      <Badge variant="outline">
                        {version.provider.toUpperCase()}
                      </Badge>
                      <Badge
                        variant={
                          version.confidence >= 0.8 ? 'default' : 'secondary'
                        }
                        className="text-xs"
                      >
                        {Math.round(version.confidence * 100)}%
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {new Date(version.generatedAt).toLocaleString()}
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed mb-2">
                    {version.summary}
                  </p>

                  {!version.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        // 这里应该调用API切换到这个版本
                        console.log('Switch to version:', version.id);
                      }}
                    >
                      使用此版本
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderQualityInsights = () => {
    if (!summaryMetadata) return null;

    const confidence = summaryMetadata.confidence || 0;
    const getQualityLevel = (conf: number) => {
      if (conf >= 0.8) return { level: '优秀', color: 'text-green-600' };
      if (conf >= 0.6) return { level: '良好', color: 'text-yellow-600' };
      return { level: '待改进', color: 'text-red-600' };
    };

    const quality = getQualityLevel(confidence);

    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            质量洞察
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${quality.color}`}>
                {Math.round(confidence * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">置信度</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {summaryMetadata.tokensUsed || 0}
              </div>
              <div className="text-xs text-muted-foreground">Token 使用</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                ${(summaryMetadata.cost || 0).toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">生成成本</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                v{summaryMetadata.version || 1}
              </div>
              <div className="text-xs text-muted-foreground">当前版本</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {quality.level}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {summaryMetadata.provider?.toUpperCase() || 'UNKNOWN'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {summaryMetadata.language?.toUpperCase() || 'ZH'}
            </Badge>
          </div>

          {confidence < 0.6 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">质量建议</div>
                <div className="text-yellow-700 mt-1">
                  当前摘要置信度较低，建议重新生成或尝试不同的AI提供商。
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={className}>
      {/* 主要摘要部分 */}
      <SummarySection
        bookmarkId={bookmarkId}
        summary={summary}
        summaryMetadata={summaryMetadata}
        processingStatus={processingStatus}
      />

      {/* 操作按钮 */}
      {summary && (
        <div className="flex items-center justify-between mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadVersionHistory}
              disabled={isLoadingVersions}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {isLoadingVersions ? '加载中...' : '版本历史'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportSummary}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              导出
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShareSummary}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              分享
            </Button>
          </div>

          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 版本历史 */}
      {renderVersionHistory()}

      {/* 质量洞察 */}
      {renderQualityInsights()}

      {/* 反馈部分 */}
      {summary && (
        <div className="mt-4">
          <SummaryFeedback
            bookmarkId={bookmarkId}
            summaryId={summaryMetadata?.version?.toString()}
          />
        </div>
      )}
    </div>
  );
};
