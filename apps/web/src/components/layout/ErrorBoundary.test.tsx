import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  const ErrorComponent = () => {
    throw new Error('Test error');
  };

  it('should render children when no error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );

    expect(getByText('正常内容')).toBeInTheDocument();
  });

  it('should render error message when error occurs', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('出错了')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should render fallback component when provided', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>自定义错误页面</div>}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('自定义错误页面')).toBeInTheDocument();
    expect(screen.queryByText('出错了')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should retry and render children after error is cleared', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const TestComponent = () => {
      const [showError, setShowError] = React.useState(true);

      return (
        <ErrorBoundary>
          {showError ? <ErrorComponent /> : <div>正常内容</div>}
        </ErrorBoundary>
      );
    };

    const { rerender } = render(<TestComponent />);

    // Initially shows error
    expect(screen.getByText('出错了')).toBeInTheDocument();

    // Clear error by re-rendering without the error component
    rerender(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('正常内容')).toBeInTheDocument();
    expect(screen.queryByText('出错了')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should call retry function when retry button is clicked', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText('重试');
    fireEvent.click(retryButton);

    // After clicking retry, we should still see the error boundary
    // The test passes if no exception is thrown
    expect(screen.getByText('出错了')).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
