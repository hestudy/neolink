import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">出错了</h2>
          <p className="text-muted-foreground mb-6">
            抱歉，应用程序遇到了意外错误。
          </p>
          <div className="bg-muted rounded-lg p-4 mb-6 max-w-md w-full">
            <p className="text-sm text-muted-foreground break-words">
              {this.state.error?.message || '未知错误'}
            </p>
          </div>
          <Button
            onClick={this.handleRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
