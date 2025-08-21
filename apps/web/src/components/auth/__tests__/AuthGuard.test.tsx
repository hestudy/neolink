import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthGuard, ProtectedRoute, PublicRoute } from '../AuthGuard';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when loading', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
      });
    });

    it('should show loading spinner by default', () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      expect(screen.getByText('验证登录状态...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show custom fallback when provided', () => {
      render(
        <AuthGuard fallback={<div>Custom Loading...</div>}>
          <div>Protected Content</div>
        </AuthGuard>
      );

      expect(screen.getByText('Custom Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should not redirect while loading', () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('when requireAuth is true (default)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });
    });

    it('should redirect unauthenticated users to login page', () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      expect(mockPush).toHaveBeenCalledWith('/login');
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should redirect to custom path when provided', () => {
      render(
        <AuthGuard redirectTo="/custom-login">
          <div>Protected Content</div>
        </AuthGuard>
      );

      expect(mockPush).toHaveBeenCalledWith('/custom-login');
    });

    it('should render content for authenticated users', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('when requireAuth is false', () => {
    it('should redirect authenticated users to dashboard', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <AuthGuard requireAuth={false}>
          <div>Public Content</div>
        </AuthGuard>
      );

      expect(mockPush).toHaveBeenCalledWith('/');
      expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
    });

    it('should render content for unauthenticated users', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
      });

      render(
        <AuthGuard requireAuth={false}>
          <div>Public Content</div>
        </AuthGuard>
      );

      expect(screen.getByText('Public Content')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe('ProtectedRoute', () => {
  it('should use AuthGuard with requireAuth=true', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect unauthenticated users', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

describe('PublicRoute', () => {
  it('should use AuthGuard with requireAuth=false', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <PublicRoute>
        <div>Public Content</div>
      </PublicRoute>
    );

    expect(screen.getByText('Public Content')).toBeInTheDocument();
  });

  it('should redirect authenticated users to dashboard', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <PublicRoute>
        <div>Public Content</div>
      </PublicRoute>
    );

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
  });
});

describe('AuthLoadingSpinner', () => {
  it('should render loading spinner with correct styling', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <AuthGuard>
        <div>Content</div>
      </AuthGuard>
    );

    const spinner = screen.getByText('验证登录状态...');
    expect(spinner).toBeInTheDocument();
    expect(spinner.parentElement?.parentElement).toHaveClass(
      'min-h-screen',
      'flex',
      'items-center',
      'justify-center',
      'bg-gray-50'
    );
  });
});
