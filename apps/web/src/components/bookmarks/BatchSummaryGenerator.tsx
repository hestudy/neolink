import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchJob {
  bookmarkId: string;
  jobId: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

interface BatchSummaryGeneratorProps {
  selectedBookmarks: string[];
  bookmarkTitles: Record<string, string>;
  onJobsComplete?: (results: BatchJob[]) => void;
  className?: string;
}

export const BatchSummaryGenerator: React.FC<BatchSummaryGeneratorProps> = ({
  selectedBookmarks,
  bookmarkTitles,
  onJobsComplete,
  className,
}) => {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [summaryLength, setSummaryLength] = useState<
    'short' | 'medium' | 'long'
  >('medium');
  const [provider, setProvider] = useState<'openai' | 'claude'>('openai');

  const startBatchGeneration = async () => {
    if (selectedBookmarks.length === 0) return;

    setIsRunning(true);
    setIsPaused(false);

    try {
      const response = await fetch('/api/bookmarks/summary/batch-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookmarkIds: selectedBookmarks,
          summaryLength,
          provider,
          force: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const initialJobs: BatchJob[] = result.jobs.map((job: any) => ({
          bookmarkId: job.bookmarkId,
          jobId: job.jobId,
          title: job.title || bookmarkTitles[job.bookmarkId] || 'Unknown',
          status: 'pending',
          progress: 0,
        }));

        setJobs(initialJobs);
        startPolling(initialJobs);
      } else {
        const error = await response.json();
        console.error('Batch generation failed:', error);
        setIsRunning(false);
      }
    } catch (error) {
      console.error('Error starting batch generation:', error);
      setIsRunning(false);
    }
  };

  const startPolling = (initialJobs: BatchJob[]) => {
    const pollInterval = setInterval(async () => {
      if (isPaused) return;

      let allCompleted = true;
      const updatedJobs = await Promise.all(
        initialJobs.map(async (job) => {
          if (job.status === 'completed' || job.status === 'failed') {
            return job;
          }

          try {
            const response = await fetch(
              `/api/bookmarks/${job.bookmarkId}/summary/status/${job.jobId}`
            );

            if (response.ok) {
              const status = await response.json();
              const updatedJob = {
                ...job,
                status: status.status,
                progress: status.progress || 0,
                error: status.error,
              };

              if (status.status !== 'completed' && status.status !== 'failed') {
                allCompleted = false;
              }

              return updatedJob;
            }
          } catch (error) {
            console.error(`Error polling job ${job.jobId}:`, error);
          }

          allCompleted = false;
          return job;
        })
      );

      setJobs(updatedJobs);

      if (allCompleted) {
        clearInterval(pollInterval);
        setIsRunning(false);
        onJobsComplete?.(updatedJobs);
      }
    }, 3000);

    return pollInterval;
  };

  const pauseResume = () => {
    setIsPaused(!isPaused);
  };

  const resetJobs = () => {
    setJobs([]);
    setIsRunning(false);
    setIsPaused(false);
  };

  const getOverallProgress = () => {
    if (jobs.length === 0) return 0;
    const totalProgress = jobs.reduce((sum, job) => sum + job.progress, 0);
    return Math.round(totalProgress / jobs.length);
  };

  const getStatusCounts = () => {
    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    jobs.forEach((job) => {
      counts[job.status]++;
    });

    return counts;
  };

  const statusCounts = getStatusCounts();
  const overallProgress = getOverallProgress();

  const renderJobStatus = (job: BatchJob) => {
    const getStatusIcon = () => {
      switch (job.status) {
        case 'completed':
          return <CheckCircle2 className="h-4 w-4 text-green-600" />;
        case 'failed':
          return <AlertCircle className="h-4 w-4 text-red-600" />;
        case 'processing':
          return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
        default:
          return <Clock className="h-4 w-4 text-gray-400" />;
      }
    };

    const getStatusColor = () => {
      switch (job.status) {
        case 'completed':
          return 'text-green-600';
        case 'failed':
          return 'text-red-600';
        case 'processing':
          return 'text-blue-600';
        default:
          return 'text-gray-500';
      }
    };

    return (
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="font-medium text-sm truncate">{job.title}</div>
            <div className={cn('text-xs', getStatusColor())}>
              {job.status === 'failed' && job.error ? job.error : job.status}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">{job.progress}%</div>
          <div className="w-16">
            <Progress value={job.progress} className="h-1" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          批量摘要生成
          {jobs.length > 0 && (
            <Badge variant="outline">{selectedBookmarks.length} 个书签</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 配置选项 */}
        {!isRunning && jobs.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">长度:</span>
                <select
                  value={summaryLength}
                  onChange={(e) => setSummaryLength(e.target.value as any)}
                  className="text-sm border border-input rounded px-2 py-1"
                >
                  <option value="short">简短</option>
                  <option value="medium">中等</option>
                  <option value="long">详细</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">提供商:</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                  className="text-sm border border-input rounded px-2 py-1"
                >
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                </select>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              将为 {selectedBookmarks.length} 个选中的书签生成摘要
            </div>
          </div>
        )}

        {/* 整体进度 */}
        {jobs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">整体进度</span>
              <span className="text-sm text-muted-foreground">
                {overallProgress}%
              </span>
            </div>

            <Progress value={overallProgress} className="h-2" />

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-600 rounded-full" />
                <span>已完成: {statusCounts.completed}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span>处理中: {statusCounts.processing}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span>等待中: {statusCounts.pending}</span>
              </div>
              {statusCounts.failed > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-600 rounded-full" />
                  <span>失败: {statusCounts.failed}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 单个任务状态 */}
        {jobs.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {jobs.map((job) => (
              <div key={job.jobId}>{renderJobStatus(job)}</div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-2">
          {!isRunning && jobs.length === 0 && (
            <Button
              onClick={startBatchGeneration}
              disabled={selectedBookmarks.length === 0}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              开始生成
            </Button>
          )}

          {isRunning && (
            <Button
              variant="outline"
              onClick={pauseResume}
              className="flex items-center gap-2"
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  继续
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  暂停
                </>
              )}
            </Button>
          )}

          {jobs.length > 0 && (
            <Button
              variant="ghost"
              onClick={resetJobs}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
          )}

          {selectedBookmarks.length > 0 && (
            <div className="text-xs text-muted-foreground ml-auto">
              预计时间: {selectedBookmarks.length * 15}-
              {selectedBookmarks.length * 30}秒
            </div>
          )}
        </div>

        {/* 提示信息 */}
        {selectedBookmarks.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">请先选择要生成摘要的书签</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
