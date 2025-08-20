'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * 认证保护组件
 * @param requireAuth - 是否需要认证，默认为true
 * @param redirectTo - 重定向路径，默认为'/login'
 * @param fallback - 加载时显示的组件
 */
export function AuthGuard({
  children,
  requireAuth = true,
  redirectTo = '/login',
  fallback = <AuthLoadingSpinner />,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // 还在加载中，不做任何操作

    if (requireAuth && !isAuthenticated) {
      // 需要认证但未认证，重定向到登录页
      router.push(redirectTo);
    } else if (!requireAuth && isAuthenticated) {
      // 不需要认证但已认证（如访问登录页时），重定向到dashboard
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, requireAuth, redirectTo, router]);

  if (isLoading) {
    return <>{fallback}</>;
  }

  // 如果需要认证但未认证，不渲染内容
  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  // 如果不需要认证但已认证，不渲染内容（将被重定向）
  if (!requireAuth && isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * 默认的加载spinner
 */
function AuthLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-600">验证登录状态...</p>
      </div>
    </div>
  );
}

/**
 * 需要认证的页面包装器
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <AuthGuard requireAuth={true}>{children}</AuthGuard>;
}

/**
 * 公共页面包装器（如登录、注册页面）
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  return <AuthGuard requireAuth={false}>{children}</AuthGuard>;
}
